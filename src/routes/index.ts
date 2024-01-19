import { _client } from '@db/mongodb';
import express from 'express';
import { createReadStream, unlink, readFileSync } from 'fs-extra';
import multer from 'multer';
import { verify } from 'service/jwtAuth';
import { getSHPZip } from 'service/geojson2shp';
import { deleteAndPublishLayer, deleteLayer, publishLayer } from 'service/geoserver';
import { importShpZipToMongo } from 'service/mongodb';
import { addRecordGeoJSON, addRecordGeoJSONFromMongoQuery } from 'service/postgre';
import { readSHPFile } from 'service/shpRead';
import { unzipFile } from 'service/unzipper';
const router = express.Router();
var upload = multer();

router.post('/ping', async function (_req, res) {
  res.status(200).send("Service is up and running!")
})

router.post('/ShpDbfToGeoserverLayer', upload.fields([{
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
  const kq = await addRecordGeoJSON(String(body?.tableNameImport).normalize("NFD").replace(/đ/gi, "d").replace(/\p{Diacritic}/gu, "")?.replaceAll(' ', '_')?.toLowerCase(), fileData);
  await deleteAndPublishLayer({
    host: `${process.env.HOST_GEOSERVER}/geoserver/rest`,
    workspaceName: 'bando',
    wmsstoreName: 'geostore',
    layerName: body?.layerName,
    tableName: String(body?.tableNameImport).normalize("NFD").replace(/đ/gi, "d").replace(/\p{Diacritic}/gu, "")?.replaceAll(' ', '_')?.toLowerCase(),
    layerTitle: body?.layerTitle || body?.layerName,
    srs: body?.srs
  })
  res.status(200).send(kq)
})


router.post('/MongoToGeoserverByQuery', async function (req, res) {
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

  let processedFilter = preprocessFilter(body?.filter)

  if (processedFilter.status !== 200) {
    res.status(400).send(processedFilter?.data)
    return;
  }

  let numberRecordAdded = await addRecordGeoJSONFromMongoQuery(
    {
      tableNameImport: String(body?.tableNameImport).normalize("NFD").replace(/đ/gi, "d").replace(/\p{Diacritic}/gu, "")?.replaceAll(' ', '_')?.toLowerCase(),
      layerTitle: body?.layerTitle || body?.layerName,
      layerName: body?.layerName,
      queryMongo: {
        collection: body?.collection,
        db: body?.db,
        filter: processedFilter?.data
      },
      mapping: body?.mapping,
      tinh_thanh: body?.tinh_thanh,
      clearCacheTinhThanh: body?.clearCacheTinhThanh,
      srs: body?.srs
    })
  if (numberRecordAdded) {
    await deleteAndPublishLayer({
      host: `${process.env.HOST_GEOSERVER}/geoserver/rest`,
      workspaceName: 'bando',
      wmsstoreName: 'geostore',
      layerName: body?.layerName,
      tableName: String(body?.tableNameImport).normalize("NFD").replace(/đ/gi, "d").replace(/\p{Diacritic}/gu, "")?.replaceAll(' ', '_')?.toLowerCase(),
      layerTitle: body?.layerTitle || body?.layerName,
      srs: body?.srs,
    })
    res.status(200).send('done')
  }
  else {
    res.status(500).send(`Lỗi đẩy dữ liệu`)
  }
  res.status(200).send()
})

router.post('/GeoJSONToGeoserverLayer', async function (req, res) {
  const body: any = req.body

  const authStatus = await verify(body?.token);
  if (authStatus?.status == 403) {
    res.send(authStatus)
    return;
  }

  const kq = await addRecordGeoJSON(String(body?.tableNameImport).normalize("NFD").replace(/đ/gi, "d").replace(/\p{Diacritic}/gu, "")?.replaceAll(' ', '_')?.toLowerCase(), body?.geoJsonData);
  if (kq) {
    await deleteAndPublishLayer({
      host: `${process.env.HOST_GEOSERVER}/geoserver/rest`,
      workspaceName: 'bando',
      wmsstoreName: 'geostore',
      layerName: body?.layerName,
      tableName: String(body?.tableNameImport).normalize("NFD").replace(/đ/gi, "d").replace(/\p{Diacritic}/gu, "")?.replaceAll(' ', '_')?.toLowerCase(),
      layerTitle: body?.layerTitle || body?.layerName,
      srs: body?.srs,
    })
  }

  res.status(200).send(kq)
})

router.post('/GeoserverLayerRemove', async function (req, res) {
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
router.post('/GeoserverLayerPublish', async function (req, res) {
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
    tableName: String(body?.tableNameImport).normalize("NFD").replace(/đ/gi, "d").replace(/\p{Diacritic}/gu, "")?.replaceAll(' ', '_')?.toLowerCase(),
    layerTitle: body?.layerTitle,
    srs: body?.srs
  })
  res.status(kq?.status || 500).send(kq)
})
router.post('/ShapefileExportByQuery', async function (req, res) {
  const body: any = req.body
  console.log('ShapefileExportByQuery', new Date().toLocaleString('vi'));

  const authStatus = await verify(body?.token);
  if (authStatus?.status == 403) {
    res.send(authStatus)
    return;
  }

  if (!body?.db || !body?.collection) {
    res.status(400).send("db, collection is required")
    return
  }

  let processedFilter = preprocessFilter(body?.filter)

  if (processedFilter.status !== 200) {
    res.status(400).send(processedFilter?.data)
    return;
  }

  const { path, name } = await getSHPZip({
    db: body?.db,
    collection: body?.collection,
    filter: processedFilter?.data,
  })
  const fileType = 'application/zip';
  res.setHeader('Content-Disposition', `attachment; filename=${name}.zip`)
  res.setHeader('Content-Type', fileType)
  let fileBuffer = await readFileSync(path)
  res.send(fileBuffer).on("finish", () => {
    unlink(path)
    res.end()
  });
})

router.post('/ShpFileZipToGeoserver', upload.single('shapefile_zip'), async function (req, res) {
  const body: any = req.body
  const authStatus = await verify(body?.token);
  if (authStatus?.status == 403) {
    res.send(authStatus)
    return;
  }
  const file = req.file as Express.Multer.File
  if (!file.originalname?.endsWith('.zip')) {
    res.status(400).send({
      message: "Zip file required"
    })
    return;

  }

  let files = await unzipFile(file.buffer)
  const fileData = await readSHPFile(files.shp, files.dbf)
  if (!fileData) {
    res.status(400).send({
      message: "File data error"
    })
  }
  const kq = await addRecordGeoJSON(String(body?.tableNameImport).normalize("NFD").replace(/đ/gi, "d").replace(/\p{Diacritic}/gu, "")?.replaceAll(' ', '_')?.toLowerCase(), fileData);
  await deleteAndPublishLayer({
    host: `${process.env.HOST_GEOSERVER}/geoserver/rest`,
    workspaceName: 'bando',
    wmsstoreName: 'geostore',
    layerName: body?.layerName,
    tableName: String(body?.tableNameImport).normalize("NFD").replace(/đ/gi, "d").replace(/\p{Diacritic}/gu, "")?.replaceAll(' ', '_')?.toLowerCase(),
    layerTitle: body?.layerTitle || body?.layerName,
    srs: body?.srs,
  })

  res.status(200).send(kq)
})
router.post('/ShpFileZipToMongo', upload.single('shapefile_zip'), async function (req, res) {
  let kq: any = {}
  const body: any = req.body
  const authStatus = await verify(body?.token);
  if (authStatus?.status == 403) {
    res.send(authStatus)
    return;
  }
  if (!body?.CodeEPSG || !body?.TiLeBanDo || !body?.db || !body?.collection) {
    res.status(400).send({
      message: 'Required field not found'
    })
    return;
  }

  const file = req.file as Express.Multer.File
  if (!file.originalname?.endsWith('.zip')) {
    res.status(400).send({
      message: "Zip file required"
    })
    return;

  }
  let files = await unzipFile(file.buffer)
  const fileData = await readSHPFile(files.shp, files.dbf)
  if (!fileData) {
    res.status(400).send({
      message: "File data error"
    })
  }
  kq = await importShpZipToMongo(file.originalname, fileData, body)
  res.status(200).send(kq)
})

function preprocessFilter(filter) {
  try {
    if (typeof (filter) == 'string') {
      return {
        status: 200,
        data: JSON.parse(filter)
      }
    }
    else if (typeof (filter) === 'object') {
      return {
        status: 200,
        data: filter
      }
    }
    else {
      return {
        status: 200,
        data: null
      }
    }
  } catch (error) {
    return {
      status: 400,
      data: error
    }
  }

}
export default router