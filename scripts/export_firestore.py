"""Local privileged CSV export. Never ship credentials or outputs to the client."""
import argparse
import csv
import json
import math
from pathlib import Path

PARTICIPANT_FIELDS = ['response_id', 'schema_version', 'catalog_version', 'consent_version', 'consent_timestamp', 'assent', 'assent_version', 'guardian_consent_version', 'created_at', 'age', 'sex', 'height_cm', 'weight_kg', 'goal', 'diet', 'foods_avoided', 'other_avoided', 'pattern', 'activity', 'day_representativeness', 'day_type', 'skipped_meals']
FOOD_FIELDS = ['response_id', 'catalog_version', 'consent_version', 'meal', 'entry_index', 'source', 'food_code', 'food_name', 'quantity', 'serving_unit']
CUSTOM_FIELDS = [*FOOD_FIELDS, 'brand', 'preparation']
PARTICIPANT_FIELDS += ['meal_count', 'meal_order', 'meal_labels']
FOOD_FIELDS += ['meal_index', 'meal_label']
CUSTOM_FIELDS += ['meal_index', 'meal_label']
MEALS = ('breakfast', 'lunch', 'snacks', 'dinner')
OCCASIONS = (*MEALS, 'extra1', 'extra2', 'extra3', 'extra4')

def safe_cell(value):
    """Neutralize spreadsheet formulas, including whitespace-prefixed payloads."""
    if value is None: return ''
    if isinstance(value, (int, float, bool)): return value
    value = str(value)
    return "'" + value if value.lstrip().startswith(('=', '+', '-', '@')) or value.startswith(('\t', '\r', '\n')) else value

def export_records(records, output):
    output.mkdir(parents=True, exist_ok=True)
    participants, logs, custom, errors = [], [], [], []
    for record_id, data in records:
        try:
            if not isinstance(data, dict) or data.get('schemaVersion') not in (2, 3) or data.get('responseId') != record_id:
                raise ValueError('Invalid schema or response identifier')
            p, c = data['profile'], data['consent']
            age = p['age']
            if isinstance(age, bool) or not isinstance(age, (int, float)) or not math.isfinite(age) or int(age) != age or age < 16: raise ValueError('Invalid age')
            if p['sex'] not in ('male', 'female'): raise ValueError('Invalid sex category')
            base = dict(response_id=record_id, catalog_version=data['catalogVersion'], consent_version=c['version'])
            meals = data['meals']
            order = data.get('mealOrder') if data['schemaVersion'] == 3 else list(MEALS)
            if not isinstance(order, list) or not 1 <= len(order) <= 8 or any(not isinstance(key, str) or key not in OCCASIONS for key in order) or len(set(order)) != len(order) or set(meals) != set(order):
                raise ValueError('Invalid meal order or missing/extra meal documents')
            labels = {}
            pending_logs, pending_custom = [], []
            for meal_index, meal_name in enumerate(order):
                meal = meals[meal_name]
                label = meal.get('label') if data['schemaVersion'] == 3 else meal_name
                if not isinstance(label, str) or not label.strip() or len(label) > 80: raise ValueError('Invalid meal label')
                labels[meal_name] = label
                entries = meal['entries']
                if not isinstance(entries, list) or len(entries) > 8 or not isinstance(meal['skipped'], bool) or (meal['skipped'] != (len(entries) == 0)): raise ValueError(f'Invalid meal: {meal_name}')
                for i, food in enumerate(entries):
                    quantity = food['quantity']
                    if isinstance(quantity, bool) or not isinstance(quantity, (int, float)) or not math.isfinite(quantity) or not 0 < quantity <= 100: raise ValueError('Invalid food quantity')
                    source = food['source']
                    if source not in ('INDB', 'CUSTOM') or not isinstance(food['name'], str) or not food['name'].strip() or not isinstance(food['unit'], str) or not food['unit'].strip(): raise ValueError('Invalid food source, name or unit')
                    if (source == 'CUSTOM' and food['foodCode'] is not None) or (source == 'INDB' and not food['foodCode']): raise ValueError('Invalid food code')
                    row = dict(**base, meal=meal_name, entry_index=i, source=source, food_code=food['foodCode'], food_name=food['name'], quantity=quantity, serving_unit=food['unit'])
                    row.update(meal_index=meal_index, meal_label=label)
                    pending_logs.append(row)
                    if source == 'CUSTOM': pending_custom.append(dict(**row, brand=food.get('brand', ''), preparation=food.get('preparation', '')))
            participant = dict(**base, schema_version=2, consent_timestamp=c.get('timestamp',''), assent=c.get('assent',False), assent_version=c.get('assentVersion',''), guardian_consent_version=c.get('guardianConsentVersion',''), created_at=data.get('createdAt',''), age=int(age), sex=p['sex'], height_cm=p.get('heightCm',''), weight_kg=p.get('weightKg',''), goal=p.get('goal',''), diet=p.get('diet',''), foods_avoided=';'.join(p.get('avoided',[])), other_avoided=p.get('otherAvoided',''), pattern=p.get('pattern',''), activity=p.get('activity',''), day_representativeness=data.get('dayRepresentativeness',''), day_type=data.get('dayType',''), skipped_meals=';'.join(m for m in order if meals[m]['skipped']))
            participant.update(schema_version=data['schemaVersion'], meal_count=len(order), meal_order=';'.join(order), meal_labels=json.dumps([labels[key] for key in order], ensure_ascii=False), skipped_meals=';'.join(key for key in order if meals[key]['skipped']))
            participants.append(participant); logs.extend(pending_logs); custom.extend(pending_custom)
        except (KeyError, TypeError, ValueError, AttributeError) as error:
            errors.append(dict(response_id=record_id, reason=str(error)))
    for filename, rows, fields in [('participants.csv',participants,PARTICIPANT_FIELDS),('food_logs.csv',logs,FOOD_FIELDS),('custom_foods.csv',custom,CUSTOM_FIELDS),('export_errors.csv',errors,['response_id','reason'])]:
        with (output / filename).open('w', newline='', encoding='utf-8') as handle:
            writer = csv.DictWriter(handle, fieldnames=fields)
            writer.writeheader()
            writer.writerows({k: safe_cell(v) for k,v in row.items()} for row in rows)
    return dict(participants=len(participants), food_logs=len(logs), custom_foods=len(custom), rejected=len(errors))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', required=True)
    parser.add_argument('--output', type=Path, default=Path('exports'))
    args = parser.parse_args()
    import firebase_admin
    from firebase_admin import firestore
    firebase_admin.initialize_app(options={'projectId': args.project})
    def load_records():
        for doc in firestore.client().collection('submissions').stream():
            data = doc.to_dict()
            data['meals'] = {meal.id: meal.to_dict() for meal in doc.reference.collection('meals').stream()}
            yield doc.id, data
    records = load_records()
    print(json.dumps(export_records(records, args.output), indent=2))
