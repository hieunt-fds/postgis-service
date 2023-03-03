import express from 'express';
import multer from 'multer';
import { deleteAndPublishLayer } from 'service/geoserver';
import { addRecordGeoJSON, addRecordGeoJSONFromMongoQuery, getUsersOver } from 'service/postgre';
import { readSHPFile } from 'service/shapefile';
const router = express.Router();
var upload = multer();

router.post('/ping', async function (_req, res) {
  res.status(200).send("Service is up and running!")
})

router.post('/connect', async function (_req, res) {
  res.status(200).send(await getUsersOver())
})
router.post('/importShapefile', upload.fields([{
  name: 'shp', maxCount: 1
}, {
  name: 'dbf', maxCount: 1
}]), async function (req, res) {
  const body: any = req.body
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  if (!files.shp?.[0]?.buffer) {
    res.status(200).send({
      message: "File Not found"
    })
    return
  }
  const fileData = await readSHPFile(files.shp?.[0]?.buffer, files.dbf?.[0]?.buffer)
  const kq = await addRecordGeoJSON(body?.tableNameImport, fileData);
  await deleteAndPublishLayer({
    host: `${process.env.HOST_GEOSERVER}/geoserver/rest`,
    workspaceName: 'bando',
    wmsstoreName: 'geostore',
    layerName: body?.layerName,
    tableName: body?.tableNameImport,
    layerTitle: body?.layerTitle || body?.layerName
  })
  res.status(200).send(kq)
})

router.post('/importFromMongoQuery', async function (req, res) {
  const body: any = req.body
  if (!body?.tableNameImport || !body?.layerName || !body?.db || !body?.collection) {
    res.status(400).send("db, collection, layerName, tableNameImport is required")
    return
  }
  await addRecordGeoJSONFromMongoQuery(
    {
      tableNameImport: body?.tableNameImport,
      layerTitle: body?.layerTitle || body?.layerName,
      layerName: body?.layerName,
      queryMongo: {
        collection: body?.collection,
        db: body?.db,
        filter: body?.filter
      },
      mapping: body?.mapping
    })
  res.status(200).send('ok')
})

router.post('/importGeoJSON', async function (req, res) {
  const body: any = req.body
  const kq = await addRecordGeoJSON(body?.tableNameImport, body?.geoJsonData);
  await deleteAndPublishLayer({
    host: `${process.env.HOST_GEOSERVER}/geoserver/rest`,
    workspaceName: 'bando',
    wmsstoreName: 'geostore',
    layerName: body?.layerName,
    tableName: body?.tableNameImport,
    layerTitle: body?.layerTitle || body?.layerName
  })
  res.status(200).send(kq)
})
export default router