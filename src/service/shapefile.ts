
// import { outputJSON } from 'fs-extra';
import { open as openShp } from 'shapefile'
export async function readSHPFile(shp, dbf?) {
  console.log('readSHPFile');

  let kq: any = [];
  try {
    await openShp(shp, dbf, {
      encoding: 'utf8'
    }).then(source =>
      source.read().then(function log(result) {
        if (result.done) return;
        kq.push(result.value)
        return source.read().then(log);
      })
    )
  }
  catch (err) {
    console.error(err.stack)
  }
  return kq;
}