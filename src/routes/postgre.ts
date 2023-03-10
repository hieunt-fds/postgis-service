import express from 'express';
import { createReadStream, unlink } from 'fs-extra';
import multer from 'multer';
import { verify } from 'service/auth';
import { getSHPZip } from 'service/geojson2shp';
import { deleteAndPublishLayer, deleteLayer, publishLayer } from 'service/geoserver';
import { addRecordGeoJSON, addRecordGeoJSONFromMongoQuery } from 'service/postgre';
import { readSHPFile } from 'service/shapefile';
import { unzipFile } from 'service/unzipper';
const router = express.Router();
var upload = multer();

router.post('/ping', async function (_req, res) {
  res.status(200).send("Service is up and running!")
})

router.post('/ShapefileImport', upload.fields([{
  name: 'shp', maxCount: 1
}, {
  name: 'dbf', maxCount: 1
}]), async function (req, res) {
  const body: any = req.body

  const authStatus = await verify(body?.token);
  if (authStatus?.status == 403) {
    res.send(authStatus)
    return;
  }

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

router.post('/ShapefileZipImport', upload.single('shapefile_zip'), async function (req, res) {
  const body: any = req.body

  const authStatus = await verify(body?.token);
  if (authStatus?.status == 403) {
    res.send(authStatus)
    return;
  }

  const file = req.file as Express.Multer.File
  let files = await unzipFile(file.buffer)
  const fileData = await readSHPFile(files.shp, files.dbf)
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

router.post('/DataFromMongoQueryImport', async function (req, res) {
  const body: any = req.body

  const authStatus = await verify(body?.token);
  if (authStatus?.status == 403) {
    res.send(authStatus)
    return;
  }

  if (!body?.tableNameImport || !body?.layerName || !body?.db || !body?.collection) {
    res.status(400).send("db, collection, layerName, tableNameImport is required")
    return
  }
  let numberRecordAdded = await addRecordGeoJSONFromMongoQuery(
    {
      tableNameImport: body?.tableNameImport,
      layerTitle: body?.layerTitle || body?.layerName,
      layerName: body?.layerName,
      queryMongo: {
        collection: body?.collection,
        db: body?.db,
        filter: body?.filter
      },
      mapping: body?.mapping,
      tinh_thanh: body?.tinh_thanh,
      clearCacheTinhThanh: body?.clearCacheTinhThanh
    })
  if (numberRecordAdded) {
    await deleteAndPublishLayer({
      host: `${process.env.HOST_GEOSERVER}/geoserver/rest`,
      workspaceName: 'bando',
      wmsstoreName: 'geostore',
      layerName: body?.layerName,
      tableName: body?.tableNameImport,
      layerTitle: body?.layerTitle || body?.layerName
    })
    res.status(200).send('done')
  }
  else {
    res.status(400).send(`Đã thêm ${numberRecordAdded} bản ghi`)
  }
  res.status(200).send()
})

router.post('/GeoJSONImport', async function (req, res) {
  const body: any = req.body

  const authStatus = await verify(body?.token);
  if (authStatus?.status == 403) {
    res.send(authStatus)
    return;
  }

  const kq = await addRecordGeoJSON(body?.tableNameImport, body?.geoJsonData);
  if (kq) {
    await deleteAndPublishLayer({
      host: `${process.env.HOST_GEOSERVER}/geoserver/rest`,
      workspaceName: 'bando',
      wmsstoreName: 'geostore',
      layerName: body?.layerName,
      tableName: body?.tableNameImport,
      layerTitle: body?.layerTitle || body?.layerName,
    })
  }

  res.status(200).send(kq)
})

router.post('/LayerRemove', async function (req, res) {
  const body: any = req.body

  const authStatus = await verify(body?.token);
  if (authStatus?.status == 403) {
    res.send(authStatus)
    return;
  }

  const kq = await deleteLayer({
    host: body?.host || `${process.env.HOST_GEOSERVER}/geoserver/rest`,
    workspaceName: body?.workspaceName || 'bando',
    wmsstoreName: body?.wmsstoreName || 'geostore',
    layerName: body?.layerName
  })
  console.log('LayerRemove', body?.layerName, kq);

  res.status(kq?.status || 500).send(kq)
})
router.post('/LayerPublish', async function (req, res) {
  const body: any = req.body
  const authStatus = await verify(body?.token);
  if (authStatus?.status == 403) {
    res.send(authStatus)
    return;
  }

  const kq = await publishLayer({
    host: body?.host || `${process.env.HOST_GEOSERVER}/geoserver/rest`,
    workspaceName: body?.workspaceName || 'bando',
    wmsstoreName: body?.wmsstoreName || 'geostore',
    layerName: body?.layerName,
    tableName: body?.tableNameImport,
    layerTitle: body?.layerTitle
  })
  res.status(kq?.status || 500).send(kq)
})
router.post('/ShapefileExportByQuery', async function (req, res) {
  const body: any = req.body

  const authStatus = await verify(body?.token);
  if (authStatus?.status == 403) {
    res.send(authStatus)
    return;
  }

  if (!body?.db || !body?.collection) {
    res.status(400).send("db, collection is required")
    return
  }
  console.log(body);
  const { path, name } = await getSHPZip({
    db: body?.db,
    collection: body?.collection,
    filter: body?.filter,
  })
  const fileType = 'application/zip';
  res.setHeader('Content-Disposition', `attachment; filename="${name}.zip"`)
  res.setHeader('Content-Type', fileType)
  // await res.status(200).sendFile(path, {
  //   root: '.'
  // })
  var readStream = createReadStream(path);
  await readStream.pipe(res).on("finish", () => {
    unlink(path)
  })
})

export default router