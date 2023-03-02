import sql from '@db/postgre'
export async function getUsersOver() {
  const users = await sql`
    select ST_AsText(the_geom)
    from dia_phan_tinh
  `
  return users
}
function genTableDesign(otherFields) {
  let kq: any = ["id SERIAL Primary key", "the_geom GEOMETRY"];
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
  let designObj = genTableDesign(otherFields)
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS ${tableName} (${designObj.join(', ')})`).then().catch()
  return await sql.unsafe(`
    insert into ${tableName} (${listFields.join(',')})
    values (${values})
  `)
}

export async function addRecordGeoJSON(tableName: string, data: any) {
  if (!(data?.length > 0)) return {
    message: 'Empty geojson data! Pls check'
  }
  await sql.unsafe(`DROP TABLE IF EXISTS ${tableName}`);
  for (let record of data || []) {
    await addRecord(tableName, record?.geometry, record?.properties);
  }
}