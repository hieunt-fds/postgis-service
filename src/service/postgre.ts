import { _client } from '@db/mongodb';
import sql from '@db/postgre'
import { pick as objectView } from 'dot-object';

export async function getUsersOver() {
  const users = await sql`
    select ST_AsText(the_geom)
    from dia_phan_tinh
  `
  return users
}
function genTableDesign(otherFields) {
  let kq: any = ["the_geom GEOMETRY"];
  for (let key in otherFields) {
    kq.push(`${key} TEXT`)
  }
  return kq
}

function genValues(geodata: string, otherFields) {
  let data = `st_geomfromgeojson('${JSON.stringify(geodata)}')`
  const listFields: any = ['the_geom']
  for (let key in otherFields) {
    listFields.push(key)
    data += `, '${otherFields[key]}'`
  }
  return { values: data, listFields }
}

async function addRecord(table, geodata: string, otherFields) {
  const { values, listFields } = genValues(geodata, otherFields)
  const tableName = table;
  return await sql.unsafe(`
    insert into ${tableName} (${listFields.join(',')})
    values (${values})
  `)
}

export async function addRecordGeoJSON(tableName: string, data: any) {
  if (!(data?.length > 0)) return {
    message: 'Empty geojson data! Pls check'
  }
  let runOnce = true;
  await sql.unsafe(`DROP TABLE IF EXISTS ${tableName}`).then().catch();
  for (let record of data || []) {
    if (runOnce) {
      let designObj = genTableDesign(record?.properties)
      await sql.unsafe(`CREATE TABLE IF NOT EXISTS ${tableName} (${designObj.join(', ')})`).then().catch()
      runOnce = false;
    }
    await addRecord(tableName, record?.geometry, record?.properties);
  }
  console.log('Done push postgre', new Date().toLocaleString('vi'));
}


export async function addRecordGeoJSONFromMongoQuery({ tableNameImport, layerTitle, layerName, mapping, queryMongo: {
  db, collection, filter
} }) {
  await sql.unsafe(`DROP TABLE IF EXISTS ${tableNameImport}`).then().catch();
  let runOnce = true;

  let cursor = _client.db(db).collection(collection).find(filter)
  while (await cursor.hasNext()) {
    let doc = await cursor.next();
    let mappingData = () => {
      // doc?.the_geom?.properties
      let data = {};
      for (let key in mapping) {
        data[key] = objectView(mapping[key], doc)
      }
      return {
        ...doc?.the_geom?.properties,
        ...data
      }
    }
    let properties = mappingData()
    if (runOnce) {
      let designObj = genTableDesign(properties)
      await sql.unsafe(`CREATE TABLE IF NOT EXISTS ${tableNameImport} (${designObj.join(', ')})`).then().catch()
      runOnce = false;
    }
    await addRecord(tableNameImport, doc?.the_geom?.geometry, properties);
  }

  // await sql.unsafe(`DROP TABLE IF EXISTS ${tableName}`).then().catch();

  // for (let record of data || []) {
  //   if (runOnce) {
  //     let designObj = genTableDesign(record?.properties)
  //     await sql.unsafe(`CREATE TABLE IF NOT EXISTS ${tableName} (${designObj.join(', ')})`).then().catch()
  //     runOnce = false;
  //   }
  //   await addRecord(tableName, record?.geometry, record?.properties);
  // }
  // console.log('Done push postgre', new Date().toLocaleString('vi'));
}