import express from 'express';
import multer from 'multer';
import path from 'path';
var upload = multer({
  storage: multer.diskStorage({
    destination: function (_req, file, cb) {
      if (file.fieldname === "file") {
        cb(null, './uploads/xlsx/')
      }
      else if (file.fieldname === "tepdinhkem") {
        cb(null, './uploads/tepdinhkem/');
      }
    },
    filename: function (_req, file, cb) {
      cb(null, `${Date.now()}${path.extname(file.originalname)}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString(
      'utf8'
    )
    cb(null, true)
  },
});
const router = express.Router();
router.post('/ping', upload.single('file'), async function (_req, res) {
  res.status(200).send("Service is up and running!")
})
export default router