import express from 'express';
import multer from 'multer';
import { addRecordGeoJSON, getUsersOver } from 'service/postgre';
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
  const fileData = await readSHPFile(files.shp?.[0]?.buffer, files.dbf?.[0]?.buffer)
  const kq = await addRecordGeoJSON(body?.tableNameImport, fileData);
  res.status(200).send(kq)
})
export default router