import { _client } from "@db/mongodb";
import { ensureDir, readJSON, writeJson } from 'fs-extra'
export async function getTinhThanh(db, clearCacheTinhThanh = false) {
  let kq = await readJSON('./tmp/C_TinhThanh.json')
  if (!kq || clearCacheTinhThanh) {
    let cursor = await _client.db(db).collection('C_TinhThanh').find({
      storage: 'regular'
    })
    while (await cursor.hasNext()) {
      let doc = await cursor.next();
      kq[doc?.MaMuc] = doc?.DoiTuongDiaLy?.[0]?.DuLieuHinhHoc
    }
    await ensureDir('./tmp/')
    await writeJson('./tmp/C_TinhThanh.json', kq)
  }
  return kq;
}