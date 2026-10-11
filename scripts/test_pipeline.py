import csv
import json
import tempfile
import unittest
from pathlib import Path
from export_firestore import export_records, safe_cell
from import_indb import import_workbook
from join_nutrition import join

ROOT = Path(__file__).resolve().parents[1]
def record():
    catalog = json.loads((ROOT / 'public/data/indb_food_catalog.json').read_text(encoding='utf-8'))
    return {'schemaVersion':2,'responseId':'synthetic','catalogVersion':catalog['version'],'consent':{'version':'test','assent':False},'profile':{'age':101,'sex':'female'},'meals':{'breakfast':{'skipped':False,'entries':[{'source':'INDB','foodCode':'ASC001','name':'Hot tea (Garam Chai)','quantity':1.25,'unit':'tea cup'},{'source':'CUSTOM','foodCode':None,'name':'=danger()','quantity':.5,'unit':'cup','brand':'','preparation':''}]},**{m:{'skipped':True,'entries':[]} for m in ['lunch','snacks','dinner']}}}

class PipelineTests(unittest.TestCase):
    def test_export_and_strict_join(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)
            report=export_records([('synthetic',record()),('bad',{})],path)
            self.assertEqual(report,dict(participants=1,food_logs=2,custom_foods=1,rejected=1))
            with (path/'participants.csv').open() as f:
                p=list(csv.DictReader(f))[0]; self.assertEqual(p['sex'],'female'); self.assertEqual(p['age'],'101')
            with (path/'custom_foods.csv').open() as f: self.assertEqual(list(csv.DictReader(f))[0]['food_name'],"'=danger()")
            join(path/'food_logs.csv',ROOT/'data/processed/indb_nutrition.csv',path/'joined.csv')
            with (path/'joined.csv').open() as f: rows=list(csv.DictReader(f))
            self.assertAlmostEqual(float(rows[0]['energy_kcal']),33.98374938964844*1.25)
            self.assertEqual(rows[1]['energy_kcal'],''); self.assertEqual(rows[1]['mapping_status'],'requires_review')
    def test_malformed_export(self):
        for age in [15,16.5,float('inf'),True]:
            r=record();r['profile']['age']=age
            with tempfile.TemporaryDirectory() as tmp: self.assertEqual(export_records([('synthetic',r)],Path(tmp))['rejected'],1)
        for age in [16,17,18,200]:
            r=record();r['profile']['age']=age
            with tempfile.TemporaryDirectory() as tmp: self.assertEqual(export_records([('synthetic',r)],Path(tmp))['participants'],1)
    def test_formula_injection(self):
        self.assertEqual(safe_cell('  =1+1'),"'  =1+1")
        self.assertEqual(safe_cell(1.25),1.25)
    def test_catalog_provenance_and_reconciliation(self):
        r=json.loads((ROOT/'data/reports/indb_import_report.json').read_text())
        c=json.loads((ROOT/'public/data/indb_food_catalog.json').read_text(encoding='utf-8'))
        self.assertEqual(r['source_records'],1014);self.assertEqual(r['source_columns'],82)
        self.assertEqual(r['included']+r['excluded'],1014)
        self.assertEqual(len(c['foods']),r['included'])
        self.assertEqual(len({f['foodCode'] for f in c['foods']}),len(c['foods']))
        self.assertTrue(all(f['servingWeightG'] is None for f in c['foods']))
    def test_import_missing_serving_data_and_duplicate_codes(self):
        import openpyxl
        from import_indb import NUTRIENTS
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp); w=openpyxl.Workbook(); s=w.active;s.title='Nutrient Data'
            s.append(['food_code','food_name','primarysource','servings_unit',*['unit_serving_'+n for n in NUTRIENTS]])
            s.append(['TEST1','Synthetic valid','test','100 g label',1,0,0,0,0,0])
            s.append(['TEST2','Missing nutrient','test','cup',None,0,0,0,0,0])
            s.append(['DUP','Duplicate A','test','cup',1,0,0,0,0,0]);s.append(['DUP','Duplicate B','test','cup',1,0,0,0,0,0])
            w.save(path/'fixture.xlsx');r=import_workbook(path/'fixture.xlsx',path/'output')
            self.assertEqual(r['included'],1);self.assertEqual(r['excluded'],3)
            food=json.loads((path/'output/public/data/indb_food_catalog.json').read_text())['foods'][0]
            self.assertIsNone(food['servingWeightG'])

if __name__ == '__main__': unittest.main()
