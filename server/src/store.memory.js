import { clone } from "./util.js";

// In-memory store with the same interface as the Firestore one. Used by the tests. Its
// transaction buffers writes and rejects reads after writes, as Firestore does.
const getPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

function matches(doc, where = []) {
  return where.every(([field, op, val]) => {
    const v = getPath(doc, field);
    switch (op) {
      case "==": return v === val;
      case "!=": return v !== val;
      case "<": return v !== undefined && v < val;
      case "<=": return v !== undefined && v <= val;
      case ">": return v !== undefined && v > val;
      case ">=": return v !== undefined && v >= val;
      case "in": return val.includes(v);
      default: throw new Error(`Unsupported operator ${op}`);
    }
  });
}

export function createMemoryStore() {
  const cols = new Map();
  let seq = 0;
  const col = (name) => {
    if (!cols.has(name)) cols.set(name, new Map());
    return cols.get(name);
  };
  const withId = (id, data) => ({ id, ...clone(data) });

  const api = {
    async get(c, id) {
      const d = col(c).get(id);
      return d ? withId(id, d) : null;
    },
    async query(c, { where = [], orderBy, limit } = {}) {
      let rows = [...col(c).entries()].filter(([, d]) => matches(d, where)).map(([id, d]) => withId(id, d));
      if (orderBy) {
        const [field, dir = "asc"] = orderBy;
        rows.sort((a, b) => {
          const x = getPath(a, field);
          const y = getPath(b, field);
          return (x > y ? 1 : x < y ? -1 : 0) * (dir === "desc" ? -1 : 1);
        });
      }
      return limit ? rows.slice(0, limit) : rows;
    },
    async count(c, where = []) {
      return (await api.query(c, { where })).length;
    },
    async set(c, id, data) {
      const { id: _drop, ...rest } = data;
      col(c).set(id, clone(rest));
    },
    async merge(c, id, patch) {
      const cur = col(c).get(id);
      if (!cur) throw new Error(`${c}/${id} does not exist`);
      col(c).set(id, { ...cur, ...clone(patch) });
    },
    async add(c, data) {
      const id = `m${String(++seq).padStart(6, "0")}`;
      await api.set(c, id, data);
      return id;
    },
    async transaction(fn) {
      const writes = [];
      let wrote = false;
      const guard = () => {
        if (wrote) throw new Error("Firestore transactions require all reads to run before any writes");
      };
      const tx = {
        async get(c, id) { guard(); return api.get(c, id); },
        async query(c, q) { guard(); return api.query(c, q); },
        set(c, id, data) { wrote = true; writes.push(() => api.set(c, id, data)); },
        merge(c, id, patch) { wrote = true; writes.push(() => api.merge(c, id, patch)); },
        add(c, data) {
          wrote = true;
          const id = `m${String(++seq).padStart(6, "0")}`;
          writes.push(() => api.set(c, id, data));
          return id;
        },
      };
      const result = await fn(tx);
      for (const w of writes) await w();
      return result;
    },
    _dump: (c) => [...col(c).entries()].map(([id, d]) => withId(id, d)),
  };
  return api;
}
