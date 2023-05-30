import { _client } from "@db/mongodb";
import { pathExists, readJSON, writeJson } from 'fs-extra'
export async function getTinhThanh(db, clearCacheTinhThanh = false) {
  let kq = await readJSON('./tmp/C_TinhThanh.json')
  if (!kq || clearCacheTinhThanh) {
    let cursor = await _client.db(db).collection('C_TinhThanh').find({
      storage: 'regular'
    }, {
      projection: {
        MaMuc: 1,
        TenMuc: 1,
        DoiTuongDiaLy: 1
      }
    })
    while (await cursor.hasNext()) {
      let doc = await cursor.next();
      kq[doc?.MaMuc] = doc?.DoiTuongDiaLy?.[0]?.DuLieuHinhHoc
    }
    await writeJson('./tmp/C_TinhThanh.json', kq)
  }
  return kq;
}
export async function getTyLeBanDo(db, clearCacheDanhMuc = false) {
  return getDanhMuc(db, 'C_TyLeBanDo', {
    MaMuc: 1,
    TenMuc: 1,
    type: 1,
    MucZoom: 1
  }, clearCacheDanhMuc)
}

export async function getHeQuyChieuBanDo(db, clearCacheDanhMuc = false) {
  return getDanhMuc(db, 'C_HeQuyChieuBanDo', {
    MaMuc: 1,
    TenMuc: 1,
    type: 1,
  }, clearCacheDanhMuc)
}

async function getDanhMuc(db: string, collection, thamchieu: object, clearCacheDanhMuc: boolean) {
  let kq: any = {};

  if (!await pathExists('./tmp/C_TyLeBanDo.json') || clearCacheDanhMuc) {
    let cursor = await _client.db(db).collection(collection).find({
      storage: 'regular'
    }, {
      projection: thamchieu
    })
    while (await cursor.hasNext()) {
      let doc = await cursor.next();
      if (doc) {
        let { _id, ...otherData } = doc;
        kq[doc?.MaMuc] = {
          _source: {
            _id: String(_id),
            ...otherData
          }
        }
      }
    }
    await writeJson(`./tmp/${collection}.json`, kq)
  }
  else {
    kq = await readJSON(`./tmp/${collection}.json`)
  }
  return kq;
}