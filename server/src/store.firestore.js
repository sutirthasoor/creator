// Firestore adapter (firebase-admin). Same interface as store.memory.js.
// Documents are plain objects plus `id`. Times are ISO strings.
export function createFirestoreStore(db) {
  const wrap = (snap) => (snap.exists ? { id: snap.id, ...snap.data() } : null);
  const strip = ({ id, ...rest }) => rest;

  function build(c, { where = [], orderBy, limit } = {}) {
    let q = db.collection(c);
    for (const [f, op, v] of where) q = q.where(f, op, v);
    if (orderBy) q = q.orderBy(orderBy[0], orderBy[1] || "asc");
    if (limit) q = q.limit(limit);
    return q;
  }

  return {
    async get(c, id) { return wrap(await db.collection(c).doc(id).get()); },
    async query(c, q) { return (await build(c, q).get()).docs.map(wrap); },
    async count(c, where = []) {
      const snap = await build(c, { where }).count().get();
      return snap.data().count;
    },
    async set(c, id, data) { await db.collection(c).doc(id).set(strip(data)); },
    async merge(c, id, patch) { await db.collection(c).doc(id).update(strip(patch)); },
    async add(c, data) { return (await db.collection(c).add(strip(data))).id; },
    transaction(fn) {
      return db.runTransaction(async (t) => {
        const ref = (c, id) => db.collection(c).doc(id);
        return fn({
          async get(c, id) { return wrap(await t.get(ref(c, id))); },
          async query(c, q) { return (await t.get(build(c, q))).docs.map(wrap); },
          set(c, id, data) { t.set(ref(c, id), strip(data)); },
          merge(c, id, patch) { t.update(ref(c, id), strip(patch)); },
          add(c, data) {
            const r = db.collection(c).doc();
            t.set(r, strip(data));
            return r.id;
          },
        });
      });
    },
  };
}
