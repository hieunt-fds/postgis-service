import { _client } from '@db/mongodb';
import sql from '@db/postgre'
import { pick as objectView } from 'dot-object';
import { getTinhThanh } from './mongodb';

function genTableDesign(otherFields) {
  let kq: any = ["the_geom GEOMETRY"];
  for (let key in otherFields) {
    kq.push(`${String(key).toLowerCase()} TEXT`)
  }
  return kq
}

function genValues(geodata: string, otherFields) {
  let objectToSave: any = {}
  // let data = `st_geomfromgeojson('${JSON.stringify(geodata)}')`
  // const listFields: any = ['the_geom']
  for (let key in otherFields) {
    objectToSave[String(key).toLowerCase()] = otherFields[key]
  }
  objectToSave['the_geom'] = JSON.stringify(geodata)
  return objectToSave
}

async function addRecord(table, geodata, otherFields) {
  const objectToSave = genValues(geodata, otherFields)
  return await sql`
  insert into ${sql(table)} ${sql(objectToSave)}`
}

export async function addRecordGeoJSON(tableName: string, data: any) {
  if (!(data?.length > 0)) return {
    message: 'Empty geojson data! Pls check'
  }
  let runOnce = true;
  try {
    await sql.unsafe(`DROP TABLE IF EXISTS ${tableName}`).then().catch();
    for (let record of data || []) {
      if (runOnce) {
        let designObj = genTableDesign(record?.properties)
        await sql.unsafe(`CREATE TABLE IF NOT EXISTS ${tableName} (${designObj.join(', ')})`).then().catch()
        runOnce = false;
      }
      await addRecord(tableName, record?.geometry, record?.properties);
    }
  } catch (error) {
    console.log(new Date().toLocaleString('vi-VN'), error);
  }
  console.log('Done push postgre', new Date().toLocaleString('vi-VN'));
}

export async function addRecordGeoJSONFromMongoQuery({ tableNameImport, layerTitle, layerName, tinh_thanh, clearCacheTinhThanh, mapping, srs, queryMongo: {
  db, collection, filter
} }) {
  let TINHTHANHGEOMETRY: any = {}
  if (tinh_thanh) {
    TINHTHANHGEOMETRY = await getTinhThanh(db, clearCacheTinhThanh)
  }
  let kq = 0;
  try {
    await sql.unsafe(`DROP TABLE IF EXISTS ${tableNameImport}`).then().catch();
    let runOnce = true;
    console.log('addRecordGeoJSONFromMongoQuery', db, collection, filter, srs);
    const MAHEQUYCHIEUBANDO = srs?.split(':')?.[1]

    let cursor = _client.db(db).collection(collection).find({
      $and: [
        filter,
        {
          DoiTuongDiaLy: { $exists: true }
        }
      ]
    })
    while (await cursor.hasNext()) {
      let doc = await cursor.next();

      let mappingData = () => {
        // doc?.the_geom?.properties
        let data = {};
        for (let key in mapping) {
          data[key] = objectView(mapping[key], doc)
        }

        return {
          // ...doc?.DoiTuongDiaLy?.[0]?.DuLieuHinhHoc?.properties, skip shp file properties
          ...data
        }
      }
      let properties = mappingData()
      if (runOnce) {
        let designObj = genTableDesign(properties)
        await sql.unsafe(`CREATE TABLE IF NOT EXISTS ${tableNameImport} (${designObj.join(', ')})`).then().catch()
        runOnce = false;
      }
      // Lọc DoiTuongDiaLy theo HeQuyChieuBanDo
      let srsFilteredData = doc?.DoiTuongDiaLy?.filter(x => {
        // TODO add MucZoom
        return x.HeQuyChieuBanDo?._source.MaMuc == MAHEQUYCHIEUBANDO
      })
      // console.log('srsFilteredData', srsFilteredData);

      if (tinh_thanh && TINHTHANHGEOMETRY[objectView(tinh_thanh?.field, doc)]?.geometry) {
        await addRecord(tableNameImport, TINHTHANHGEOMETRY[objectView(tinh_thanh?.field, doc)]?.geometry, properties);
      }
      else if (srsFilteredData?.length > 0) {
        for (const doiTuong of srsFilteredData) {
          if (doiTuong?.DuLieuHinhHoc?.geometry) {
            await addRecord(tableNameImport, doiTuong?.DuLieuHinhHoc?.geometry, properties);
            kq++;
          }
        }
      }
      else {
        // console.log(String(doc?._id), 'geometry not found');
      }
    }
  } catch (error) {
    console.log(new Date().toLocaleString('vi-VN'), error);
  }

  return kq
}