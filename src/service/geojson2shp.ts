import { _client } from '@db/mongodb'
import { convert } from 'geojson2shp'

async function convertGeoJSON2SHP(name, features) {
  const options = {
    layer: name,
    targetCrs: 4326
  }
  const path = `./tmp/${name}_${new Date().getTime()}.zip`
  // const features = [
  //   { type: 'Feature', geometry: {/* */ }, properties: {} },
  //   { type: 'Feature', geometry: {/* */ }, properties: {} }
  // ]
  await convert(features, path, options)
  return { path, name }
}

export async function getSHPZip({ db, collection, filter }) {

  let features: any = []
  const exportLayerName = `${db}___${collection}`

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
    if (doc?.DoiTuongDiaLy?.[0]?.DuLieuHinhHoc?.geometry) {
      features.push({
        properties: {},
        ...doc?.DoiTuongDiaLy?.[0]?.DuLieuHinhHoc
      })
    }
  }
  return await convertGeoJSON2SHP(exportLayerName, features)
}