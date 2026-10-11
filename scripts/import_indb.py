"""Reproducible serving-only INDB import. Never infer grams or mix bases."""
import argparse
import csv
import hashlib
import json
import math
import re
from collections import Counter
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
NUTRIENTS = ('energy_kcal', 'protein_g', 'carb_g', 'fat_g', 'fibre_g', 'sodium_mg')
IMPORTER_VERSION = '2'

def text(value):
    return '' if value is None else str(value).strip()

def valid_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0

def write_csv(path, rows, fields):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', newline='', encoding='utf-8') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

def import_workbook(path, root=ROOT):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    version = f'indb-{digest[:16]}-serving-v{IMPORTER_VERSION}'
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sheet = workbook['Nutrient Data']
    iterator = sheet.iter_rows(values_only=True)
    headers = list(next(iterator))
    required = ['food_code', 'food_name', 'primarysource', 'servings_unit'] + ['unit_serving_' + n for n in NUTRIENTS]
    missing = set(required) - set(headers)
    if missing:
        raise ValueError(f'Missing columns: {sorted(missing)}')
    rows = [(i, dict(zip(headers, values))) for i, values in enumerate(iterator, 2) if any(v is not None for v in values)]
    codes = Counter(text(row['food_code']) for _, row in rows)
    public, nutrition, exclusions = [], [], []
    for excel_row, row in rows:
        code, name, unit = (text(row[k]) for k in ('food_code', 'food_name', 'servings_unit'))
        reasons = []
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,40}', code): reasons.append('missing_or_invalid_food_code')
        if codes[code] > 1: reasons.append('duplicate_code_requires_review')
        if not name or len(name) > 200: reasons.append('missing_or_invalid_food_name')
        if not unit or unit.lower() in ('nan', 'none', 'na', 'n/a', '-') or len(unit) > 80: reasons.append('missing_or_invalid_serving_unit')
        for n in NUTRIENTS:
            if not valid_number(row['unit_serving_' + n]): reasons.append('missing_or_invalid_unit_serving_' + n)
        if reasons:
            exclusions.append(dict(excel_row=excel_row, food_code=code, food_name=name, reasons=';'.join(reasons)))
            continue
        aliases = re.findall(r'\(([^)]+)\)', name)
        # Search synonyms are suggestions only. Every hit retains its actual recipe name/code.
        for group in (('curd', 'dahi', 'yogurt', 'yoghurt'), ('roti', 'chapati', 'chapatti', 'phulka')):
            if any(re.search(r'\b' + word + r'\b', name, re.I) for word in group): aliases.extend(group)
        public.append(dict(foodCode=code, name=name, unit=unit, aliases=sorted(set(aliases)), servingWeightG=None))
        nutrition.append(dict(catalog_version=version, food_code=code, food_name=name, primarysource=text(row['primarysource']), nutrient_basis='per_serving', servings_unit=unit, serving_weight_g='', **{n: row['unit_serving_' + n] for n in NUTRIENTS}))
    workbook.close()
    public.sort(key=lambda item: item['foodCode'])
    nutrition.sort(key=lambda item: item['food_code'])
    report = dict(catalog_version=version, importer_version=IMPORTER_VERSION, source_file=path.name, source_sha256=digest, worksheet='Nutrient Data', source_records=len(rows), source_columns=len(headers), included=len(public), excluded=len(exclusions), exclusion_reasons=dict(Counter(reason for row in exclusions for reason in row['reasons'].split(';'))), nutrient_basis='per_serving', mapping={n: 'unit_serving_' + n for n in NUTRIENTS}, serving_weight_policy='Unknown. Serving labels are never parsed as grams.', base_columns_policy='Not used: unqualified nutrient columns have no verified measurement basis in workbook metadata.')
    for folder in ('public/data', 'data/processed', 'data/reports'):
        (root / folder).mkdir(parents=True, exist_ok=True)
    catalog = dict(version=version, sourceSha256=digest, foods=public)
    content = json.dumps(catalog, ensure_ascii=False, indent=2) + '\n'
    (root / 'public/data/indb_food_catalog.json').write_text(content, encoding='utf-8')
    (root / f'data/processed/{version}.json').write_text(content, encoding='utf-8')
    fields = ['catalog_version', 'food_code', 'food_name', 'primarysource', 'nutrient_basis', 'servings_unit', 'serving_weight_g', *NUTRIENTS]
    write_csv(root / 'data/processed/indb_nutrition.csv', nutrition, fields)
    write_csv(root / f'data/processed/{version}.csv', nutrition, fields)
    write_csv(root / 'data/reports/indb_exclusions.csv', exclusions, ['excel_row', 'food_code', 'food_name', 'reasons'])
    (root / 'data/reports/indb_import_report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    return report

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workbook', type=Path)
    args = parser.parse_args()
    print(json.dumps(import_workbook(args.workbook.resolve()), indent=2))
