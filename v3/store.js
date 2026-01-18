// ===============================
// Custom Holidays (month-day)
// Stored as { id, md: "MM-DD", name }
// ===============================

export async function getCustomHolidays() {
  const db = await openDB();
  const tx = db.transaction(STORES_CONST.SETTINGS, "readonly");
  const store = tx.objectStore(STORES_CONST.SETTINGS);
  const req = store.get("customHolidays");
  const res = await promisifyRequest(req);
  const list = Array.isArray(res?.value) ? res.value : [];
  return list;
}

export async function addCustomHoliday(md, name) {
  const clean = String(md || "").trim();
  const cleanName = String(name || "").trim();
  if (!/^\d{2}-\d{2}$/.test(clean)) throw new Error("Holiday md must be MM-DD");
  if (!cleanName) throw new Error("Holiday name required");

  const list = await getCustomHolidays();
  list.push({ id: cryptoId(), md: clean, name: cleanName });

  await setSettingsKey("customHolidays", list);
  return list;
}

export async function deleteCustomHoliday(id) {
  const list = await getCustomHolidays();
  const next = list.filter(x => x.id !== id);
  await setSettingsKey("customHolidays", next);
  return next;
}

export async function updateCustomHoliday(id, patch) {
  const list = await getCustomHolidays();
  const next = list.map(x => {
    if (x.id !== id) return x;
    const md = patch.md != null ? String(patch.md).trim() : x.md;
    const name = patch.name != null ? String(patch.name).trim() : x.name;
    if (!/^\d{2}-\d{2}$/.test(md)) throw new Error("Holiday md must be MM-DD");
    if (!name) throw new Error("Holiday name required");
    return { ...x, md, name };
  });
  await setSettingsKey("customHolidays", next);
  return next;
}

// helpers used above (these likely already exist in your store.js)
// - openDB()
// - STORES_CONST
// - promisifyRequest(req)
// - setSettingsKey(key, value)
// - cryptoId()