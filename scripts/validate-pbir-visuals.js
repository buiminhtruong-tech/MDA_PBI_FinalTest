const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const reportRoot = path.join(root, "Vending Machine Analysis.Report");
const modelRoot = path.join(root, "Vending Machine Analysis.SemanticModel");
const pagesRoot = path.join(reportRoot, "definition", "pages");
const reportJsonPath = path.join(reportRoot, "definition", "report.json");
const pbirPath = path.join(reportRoot, "definition.pbir");
const pagesJsonPath = path.join(pagesRoot, "pages.json");
const tablesRoot = path.join(modelRoot, "definition", "tables");

const VISUAL_SCHEMA_PATTERN =
  /^https:\/\/developer\.microsoft\.com\/json-schemas\/fabric\/item\/report\/definition\/visualContainer\/(\d+)\.(\d+)\.(\d+)\/schema\.json$/;

const allowedVisualTypes = new Set([
  "cardVisual",
  "tableEx",
  "lineChart",
  "clusteredBarChart",
  "clusteredColumnChart",
  "donutChart",
  "slicer",
]);

const errors = [];
const warnings = [];
const observedVisualSchemaVersions = new Set();

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`${file}: invalid JSON (${error.message})`);
    return null;
  }
}

function walkFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, predicate, out);
    else if (predicate(full)) out.push(full);
  }
  return out;
}

function parseModelFields() {
  const model = new Map();
  if (!fs.existsSync(tablesRoot)) {
    errors.push(`Missing semantic model tables folder: ${tablesRoot}`);
    return model;
  }

  for (const file of fs.readdirSync(tablesRoot).filter((name) => name.endsWith(".tmdl"))) {
    const fullPath = path.join(tablesRoot, file);
    const text = fs.readFileSync(fullPath, "utf8");
    const tableName = text.match(/^table\s+(.+)$/m)?.[1]?.trim().replace(/^'|'$/g, "");
    if (!tableName) continue;

    const fields = new Set();
    for (const match of text.matchAll(/^\s+(?:column|measure)\s+'?([^'\r\n=]+)'?/gm)) {
      fields.add(match[1].trim());
    }
    model.set(tableName, fields);
  }

  return model;
}

function validateFieldReferences(value, model, file) {
  if (!value || typeof value !== "object") return;

  for (const kind of ["Column", "Measure"]) {
    if (!value[kind]) continue;
    const entity = value[kind].Expression?.SourceRef?.Entity;
    const property = value[kind].Property;
    if (!entity || !property) {
      errors.push(`${file}: malformed ${kind} reference`);
      continue;
    }
    if (!model.has(entity) || !model.get(entity).has(property)) {
      errors.push(`${file}: missing semantic model field ${entity}.${property}`);
    }
  }

  for (const child of Object.values(value)) validateFieldReferences(child, model, file);
}

function validateQueryState(queryState, visualType, file) {
  if (!queryState || typeof queryState !== "object") {
    errors.push(`${file}: visual.query.queryState is required`);
    return;
  }

  for (const [role, roleState] of Object.entries(queryState)) {
    if (Array.isArray(roleState)) {
      errors.push(`${file}: queryState.${role} uses legacy array syntax; use ${role}.projections`);
      continue;
    }
    if (!roleState || !Array.isArray(roleState.projections)) {
      errors.push(`${file}: queryState.${role}.projections must be an array`);
      continue;
    }
    for (const projection of roleState.projections) {
      if (!projection.field) errors.push(`${file}: projection in ${role} missing field`);
      if (!projection.queryRef) errors.push(`${file}: projection in ${role} missing queryRef`);
      if (!projection.nativeQueryRef) warnings.push(`${file}: projection ${projection.queryRef || role} missing nativeQueryRef`);
    }
  }

  if (visualType === "cardVisual" && !queryState.Data) {
    errors.push(`${file}: cardVisual should use queryState.Data.projections`);
  }
  if (visualType === "slicer" && !queryState.Values) {
    errors.push(`${file}: slicer should use queryState.Values.projections`);
  }
}

function collectRoleEntities(queryState) {
  const roleEntities = [];
  for (const [role, roleState] of Object.entries(queryState || {})) {
    if (!roleState || !Array.isArray(roleState.projections)) continue;
    const entities = new Set();
    for (const projection of roleState.projections) {
      const field = projection.field || {};
      const entity =
        field.Column?.Expression?.SourceRef?.Entity ||
        field.Measure?.Expression?.SourceRef?.Entity;
      if (entity) entities.add(entity);
    }
    roleEntities.push({ role, entities: [...entities] });
  }
  return roleEntities;
}

function validateFactMix(queryState, file) {
  const roles = collectRoleEntities(queryState);
  const categoryEntities = roles
    .filter((role) => ["Category", "Values"].includes(role.role))
    .flatMap((role) => role.entities)
    .filter((entity) => entity.startsWith("Fact_"));
  const measureEntities = roles
    .filter((role) => ["Y", "Data"].includes(role.role))
    .flatMap((role) => role.entities)
    .filter((entity) => entity.startsWith("Fact_"));

  for (const categoryEntity of categoryEntities) {
    for (const measureEntity of measureEntities) {
      if (categoryEntity !== measureEntity) {
        warnings.push(
          `${file}: category uses ${categoryEntity} while value uses ${measureEntity}; confirm relationship or use a shared dimension/bridge`
        );
      }
    }
  }
}

function validateVisual(file, page) {
  const visual = readJson(file);
  if (!visual) return;

  const schemaMatch = typeof visual.$schema === "string" ? visual.$schema.match(VISUAL_SCHEMA_PATTERN) : null;
  if (!schemaMatch) {
    errors.push(`${file}: wrong visual schema ${visual.$schema || "<missing>"}`);
  } else {
    const major = Number(schemaMatch[1]);
    const version = `${schemaMatch[1]}.${schemaMatch[2]}.${schemaMatch[3]}`;
    observedVisualSchemaVersions.add(version);
    if (major < 2) {
      errors.push(`${file}: legacy visual schema ${version}; use visualContainer 2.x or newer`);
    }
  }

  const folderName = path.basename(path.dirname(file));
  if (visual.name !== folderName) {
    errors.push(`${file}: visual.name (${visual.name}) must match folder name (${folderName})`);
  }

  const position = visual.position || {};
  for (const key of ["x", "y", "width", "height"]) {
    if (typeof position[key] !== "number") errors.push(`${file}: position.${key} must be a number`);
  }
  if (
    typeof position.x === "number" &&
    typeof position.width === "number" &&
    position.x + position.width > page.width
  ) {
    errors.push(`${file}: visual extends beyond page width`);
  }
  if (
    typeof position.y === "number" &&
    typeof position.height === "number" &&
    position.y + position.height > page.height
  ) {
    errors.push(`${file}: visual extends beyond page height`);
  }

  const visualConfig = visual.visual;
  if (!visualConfig) {
    errors.push(`${file}: missing visual object`);
    return;
  }

  if (!allowedVisualTypes.has(visualConfig.visualType)) {
    errors.push(`${file}: unsupported or legacy visualType ${visualConfig.visualType}`);
  }

  validateQueryState(visualConfig.query?.queryState, visualConfig.visualType, file);
  validateFactMix(visualConfig.query?.queryState, file);
}

function validateProject() {
  const pbir = readJson(pbirPath);
  if (pbir && pbir.version !== "4.0") {
    warnings.push(`${pbirPath}: expected PBIR version 4.0, found ${pbir.version}`);
  }

  const reportJson = readJson(reportJsonPath);
  if (reportJson) {
    const baseTheme = reportJson.themeCollection?.baseTheme?.name;
    if (!baseTheme) errors.push(`${reportJsonPath}: missing themeCollection.baseTheme.name`);
    const themeItem = reportJson.resourcePackages
      ?.find((pkg) => pkg.name === "SharedResources")
      ?.items?.find((item) => item.type === "BaseTheme");
    if (!themeItem?.path) {
      errors.push(`${reportJsonPath}: missing SharedResources BaseTheme item`);
    } else {
      const themePath = path.join(reportRoot, "StaticResources", "SharedResources", themeItem.path);
      if (!fs.existsSync(themePath)) errors.push(`${reportJsonPath}: theme file not found at ${themePath}`);
    }
  }

  const pagesJson = readJson(pagesJsonPath);
  if (!pagesJson) return;
  if (!Array.isArray(pagesJson.pageOrder) || pagesJson.pageOrder.length === 0) {
    errors.push(`${pagesJsonPath}: pageOrder must be a non-empty array`);
    return;
  }
  if (!pagesJson.pageOrder.includes(pagesJson.activePageName)) {
    errors.push(`${pagesJsonPath}: activePageName must exist in pageOrder`);
  }

  const pageFolders = fs
    .readdirSync(pagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(pagesRoot, entry.name));

  const pagesByName = new Map();
  for (const pageFolder of pageFolders) {
    const pageJsonPath = path.join(pageFolder, "page.json");
    if (!fs.existsSync(pageJsonPath)) continue;
    const pageJson = readJson(pageJsonPath);
    if (!pageJson) continue;
    if (pagesByName.has(pageJson.name)) errors.push(`${pageJsonPath}: duplicate page name ${pageJson.name}`);
    pagesByName.set(pageJson.name, { folder: pageFolder, page: pageJson });
  }

  const model = parseModelFields();

  for (const pageName of pagesJson.pageOrder) {
    const entry = pagesByName.get(pageName);
    if (!entry) {
      errors.push(`${pagesJsonPath}: pageOrder references missing page ${pageName}`);
      continue;
    }

    const legacyDir = path.join(entry.folder, "visualContainers");
    if (fs.existsSync(legacyDir)) {
      errors.push(`${entry.folder}: active page contains legacy visualContainers folder`);
    }

    const visualsDir = path.join(entry.folder, "visuals");
    if (!fs.existsSync(visualsDir)) {
      errors.push(`${entry.folder}: missing visuals folder`);
      continue;
    }

    const visualFiles = walkFiles(visualsDir, (file) => path.basename(file) === "visual.json");
    if (visualFiles.length === 0) errors.push(`${entry.folder}: visuals folder contains no visual.json files`);

    const pageWidth = entry.page.width || 1280;
    const pageHeight = entry.page.height || 720;
    for (const visualFile of visualFiles) {
      validateVisual(visualFile, { width: pageWidth, height: pageHeight });
      const json = readJson(visualFile);
      if (json) validateFieldReferences(json.visual?.query, model, visualFile);
    }
  }
}

validateProject();

if (observedVisualSchemaVersions.size > 1) {
  warnings.push(
    `Mixed visual schema versions detected: ${[...observedVisualSchemaVersions].sort().join(", ")}. This can happen after Power BI Desktop saves only some visuals; keep new visual edits on the latest observed version.`
  );
}

for (const warning of warnings) console.warn(`WARNING: ${warning}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log("PBIR visual validation passed.");
