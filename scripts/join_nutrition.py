"""Strict versioned join for the existing MOO pipeline. Unmatched foods stay unknown."""
import argparse
import csv
from pathlib import Path
from import_indb import NUTRIENTS

def join(logs_path, nutrition_path, output):
    with nutrition_path.open(encoding='utf-8', newline='') as f:
        catalog = {}
        for row in csv.DictReader(f):
            key = (row['catalog_version'], row['food_code'])
            if key in catalog or row['nutrient_basis'] != 'per_serving': raise ValueError('Duplicate key or incompatible nutrient basis')
            catalog[key] = row
    with logs_path.open(encoding='utf-8', newline='') as source, output.open('w', encoding='utf-8', newline='') as dest:
        reader = csv.DictReader(source)
        writer = csv.DictWriter(dest, fieldnames=[*(reader.fieldnames or []), 'mapping_status', *NUTRIENTS])
        writer.writeheader()
        for row in reader:
            match = catalog.get((row['catalog_version'], row['food_code'])) if row['source'] == 'INDB' else None
            compatible = match and match['servings_unit'] == row['serving_unit'] and match['food_name'] == row['food_name']
            row.update(mapping_status='matched' if compatible else 'requires_review')
            row.update({n: float(match[n]) * float(row['quantity']) if compatible else '' for n in NUTRIENTS})
            writer.writerow(row)

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('food_logs', type=Path); p.add_argument('nutrition_catalog', type=Path); p.add_argument('output', type=Path)
    a = p.parse_args(); join(a.food_logs, a.nutrition_catalog, a.output)
