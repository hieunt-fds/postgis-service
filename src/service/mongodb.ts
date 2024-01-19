import { _client } from "@db/mongodb";
import axios from "axios";
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

export async function importShpZipToMongo(fileName, fileData, body) {
  let kq: any = {};
  let now = new Date()
  let startTime = now.getTime();
  let startTimeStr = now.toLocaleString('vi');
  let ketQuaImport = {
    duplicate: 0,
    created: 0,
    error: 0
  }
  const DANHMUCHEQUYCHIEUBANDO = await getHeQuyChieuBanDo(body?.db, body?.clearCacheDanhMuc);
  const DANHMUCTYLEBANDO = await getTyLeBanDo(body?.db, body?.clearCacheDanhMuc);
  // list bản đồ
  for (let feature of fileData) {
    if (feature?.properties) {
      let lstIdUpdated: string[] = []
      let tableName = body.collection.split('_')?.[1];
      let mappingkey = {
        'T_CoSoBaoTonDDSH_bak': 'IDCSBT', //test
        'T_CoSoBaoTonDDSH': 'IDCSBT',
        'T_KhuVucBaoTonDDSH': 'IDKhuVucBa'
      }

      if (!feature.properties?.MaDinhDanh && !feature.properties[mappingkey[body.collection]]) {
        console.log('Không có field mã MaDinhDanh và ' + mappingkey[body.collection])
        ketQuaImport.error++
        continue;
      }
      // Tìm bản ghi khớp với bản đồ
      let cursor = await _client.db(body.db).collection(body.collection).find({
        $and: [
          {
            $or: [
              ...feature.properties?.MaDinhDanh ? [{
                MaDinhDanh: String(feature.properties?.MaDinhDanh)
              }] : [],
              ...feature.properties?.[mappingkey[body.collection]] ? [
                {
                  MaDinhDanh: String(feature.properties[mappingkey[body.collection]])
                },
                {
                  MaDinhDanh: Number(feature.properties[mappingkey[body.collection]])
                }] : []

            ]
          },
          {
            storage: {
              $ne: "trash"
            }
          }
        ]
      }, {
        projection: {
          MaDinhDanh: 1,
          ['ID' + tableName]: 1,
          DoiTuongDiaLy: 1
        }
      })
      while (await cursor.hasNext()) {
        let doc = await cursor.next();

        if (doc?._id) {
          const HEQUYCHIEUBANDO = body?.CodeEPSG;
          const TYLEBANDO = body?.TiLeBanDo;
          let ViTriDiaLy = {
            'KinhDo': feature.properties.kinhDo,
            'ViDo': feature.properties.viDo
          }

          // check các phần tử Đối tượng địa lý TiLeBanDo & HeQuyChieuBanDo
          if (doc?.DoiTuongDiaLy) {
            let isNew = true;
            for (let banDo of doc.DoiTuongDiaLy || []) {
              if (banDo.HeQuyChieuBanDo?._source?.MaMuc == HEQUYCHIEUBANDO && banDo.TiLeBanDo?._source?.MaMuc == TYLEBANDO) {
                // chung tỷ lệ, code ESPG => đè dữ liệu bản đồ
                banDo = {
                  ...banDo,
                  DuLieuHinhHoc: feature
                }
                isNew = false;
                ketQuaImport.duplicate++
                break;
              }
            }
            if (isNew) {
              // thêm mới
              let newDoiTuongDiaLy = {
                HeQuyChieuBanDo: DANHMUCHEQUYCHIEUBANDO[HEQUYCHIEUBANDO],
                TiLeBanDo: DANHMUCTYLEBANDO[Number(TYLEBANDO)],
                DuLieuHinhHoc: feature
              }
              doc.DoiTuongDiaLy.push(newDoiTuongDiaLy)
              ketQuaImport.created++
            }
          }
          else {
            // thêm mảng mới
            let newDoiTuongDiaLy = {
              TiLeBanDo: DANHMUCTYLEBANDO[Number(TYLEBANDO)],
              HeQuyChieuBanDo: DANHMUCHEQUYCHIEUBANDO[HEQUYCHIEUBANDO],
              DuLieuHinhHoc: feature
            }
            doc.DoiTuongDiaLy = [newDoiTuongDiaLy]
            ketQuaImport.created++
          }
          // update
          await _client.db(body.db).collection(body.collection).updateOne({
            _id: doc?._id
          }, {
            $set: {
              DoiTuongDiaLy: doc.DoiTuongDiaLy,
              ViTriDiaLy: ViTriDiaLy
            }
          })
          lstIdUpdated.push(String(doc._id))
        }
      }
      if (lstIdUpdated.length > 0) {
        kq[feature?.properties?.OBJECTID] = `Updated id: ${lstIdUpdated.join(', ')}`;
      }
      else {
        kq[feature?.properties?.OBJECTID] = `OBJECTID ${feature?.properties?.OBJECTID} not found`
        console.log(`Not found MaDinhDanh: ${feature?.properties?.MaDinhDanh} hoặc ${mappingkey[body.collection]}: ${feature?.properties?.[mappingkey[body.collection]]}`)
        ketQuaImport.error++
      }
    }
  }

  await createOne(body?.token, body?.db, 'T_ImportExportBanDo', {
    startTime,
    startTimeStr,
    storage: 'regular',
    TiLeBanDo: DANHMUCTYLEBANDO[body?.TiLeBanDo],
    HeQuyChieuBanDo: DANHMUCHEQUYCHIEUBANDO?.[body?.CodeEPSG],
    Collection: body?.collection,
    KetQua: ketQuaImport,
    fileName: fileName,
    sourceRef: 'importShpZipToMongo',
    userName: 'postgis_service',
    site: body?.db == 'CSDL_MTQA' ? 'csdl_mt' : 'data'
  })
}

async function createOne(token, db, collection, data) {
  var query = `mutation add($token: String, $db: String, $collection: String, $body: JSON, $actionCode: String) {
    userCreate: userCreate(token: $token, db: $db, collection: $collection, body: $body, actionCode: $actionCode)
  }`;
  var data: any = JSON.stringify({
    query: query,
    variables: {
      "token": token,
      "db": db,
      "collection": collection,
      "body": data,
      "actionCode": 'NEW'
    }
  });
  return await axios({
    method: 'post',
    url: 'http://vuejx-core:3000/',
    headers: {
      'Content-Type': 'application/json'
    },
    data: data
  })
    .then(function (response) {
      return response?.data
    })
    .catch(function (error) {
    });
}