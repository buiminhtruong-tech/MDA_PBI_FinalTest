# Power BI PBIR Visual Authoring Rules

Ap dung cho project `Vending Machine Analysis.pbip`.

## 1. Source Of Truth

- PBIP/PBIR source la source of truth: sua trong `Vending Machine Analysis.Report/definition` va `Vending Machine Analysis.SemanticModel/definition`.
- Khong xem file `.pbix` binary la source chinh khi tao visual bang code. Sau khi sua PBIR, dong Power BI Desktop va mo lai `.pbip` neu can reload.
- Truoc khi sua visual tu code, hay dam bao cac thay doi thu cong trong Power BI Desktop da duoc save.

## 2. Microsoft PBIR Structure

- Report dang dung PBIR `definition.pbir` version `4.0` va report schema `3.2.0`.
- Visual schema phai la Microsoft `visualContainer` schema the he `2.x` tro len. Power BI Desktop co the save mot so visual bang version moi hon, vi du `2.11.0`.
- Active visual bat buoc nam tai:

```text
Vending Machine Analysis.Report/definition/pages/<pageFolder>/visuals/<visualName>/visual.json
```

- Khong tao visual moi trong `visualContainers`. Folder `visualContainers` la legacy format va co the lam Power BI mo page nhung canvas trong.
- Neu can giu file cu de doi chieu, dua chung ra ngoai `definition/pages`, vi du `_legacy_visualContainers_backup_YYYYMMDD`.

## 3. Page Rules

- `pages.json.pageOrder` phai chua gia tri `page.json.name`, khong phai folder name.
- Moi page trong `pageOrder` phai map duoc dung 1 folder co `page.json`.
- `pages.json.activePageName` phai ton tai trong `pageOrder`.
- Moi page dang active trong report phai co folder `visuals` va co it nhat 1 `visual.json`.

## 4. Visual JSON Rules

- Moi `visual.json` phai dung Microsoft visual container schema dang ho tro:

```json
"$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/<2.x-or-newer>/schema.json"
```

- Khong dung legacy schema `visualContainer/1.x.x`.
- `visual.json.name` phai trung voi ten folder chua no.
- Dung modern visual type:
  - `cardVisual` thay cho legacy `card`
  - `tableEx` thay cho legacy `table`
  - `lineChart`, `clusteredBarChart`, `clusteredColumnChart`, `donutChart`, `slicer`
- Khong dung role array cu:

```json
"Category": [
  { "field": "...", "queryRef": "..." }
]
```

- Phai dung role object co `projections`:

```json
"Category": {
  "projections": [
    { "field": "...", "queryRef": "...", "nativeQueryRef": "..." }
  ]
}
```

- Card visual dung role `Data.projections`; chart dung role phu hop nhu `Category`, `Y`; slicer dung `Values`.
- Moi projection phai co `field`, `queryRef`, va nen co `nativeQueryRef`.
- `position.x + width` khong duoc vuot page width; `position.y + height` khong duoc vuot page height.

## 5. Semantic Binding Rules

- Moi field binding trong visual phai ton tai trong TMDL model.
- Khong bind toi ten cot khong ton tai, vi du sai: `Dim_Machine.MachineModel`; dung: `Dim_Machine.MachineModelName`.
- Khong tron category tu fact table A voi measure tu fact table B neu hai fact khong co relationship/bridge/TREATAS ro rang.
  - Loi da gap: `Fact_PurchaseOrder.SupplierName` + `[Total Inbound Value]` lam lap cung 1 tong cho moi supplier.
  - Cach dung: `Fact_InboundInventory.SupplierName` + `[Total Inbound Value]`.
- Truoc khi tao chart breakdown, kiem tra cardinality cua category. Neu chi co 1 gia tri, khong dung breakdown chart; doi sang trend, detail table, KPI, hoac dimension co y nghia hon.
  - Loi da gap: `Fact_MachineTransfer.SourceWarehouseName` chi co `KHO QUAN 03`, nen chart by source warehouse khong huu ich.

## 6. Report Design Rules

- Moi page phai co title ro `SkillsHub Vietnam`.
- Moi page can co slicer chung neu phu hop: `Year`, `District`, `Location Type`, `Product Category`, `Machine Status`.
- Theme hien tai la light theme:
  - page background `#F8FAFC`
  - visual/card background `#FFFFFF`
  - primary text `#0F172A`
  - border/grid `#CBD5E1` hoac `#E2E8F0`
  - accents theo taxonomy: cyan, emerald, amber, purple
- Title cua chart phai mo ta dung metric va grain, vi du `Inbound Inventory Value by Supplier`, `Transfer Value Trend by Date`.

## 7. Required Validation

Sau moi lan tao/sua visual bang code, chay:

```powershell
node scripts/validate-pbir-visuals.js
```

Validator phai pass truoc khi mo lai Power BI Desktop.

## 8. Microsoft References

- Power BI report folder and PBIR format: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report
- Enhanced report format overview: https://learn.microsoft.com/en-us/power-bi/developer/embedded/projects-enhanced-report-format
- Power BI report authoring skill overview: https://learn.microsoft.com/en-us/power-bi/developer/agentic/power-bi-report-authoring-skill-overview
