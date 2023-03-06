import unzipper from 'unzipper'
export async function unzipFile(buffer) {
  let kq: any = {}
  const dir = await unzipper.Open.buffer(buffer);
  if (dir?.files?.length > 0) {
    for (let file of dir.files) {
      if (String(file?.path).endsWith('shp')) {
        kq.shp = await file.buffer()
      }
      else if (String(file?.path).endsWith('dbf')) {
        kq.dbf = await file.buffer()
      }
    }
  }
  console.log(kq);

  return await kq;
}
