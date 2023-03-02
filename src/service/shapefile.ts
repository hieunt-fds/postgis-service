
// import { outputJSON } from 'fs-extra';
import { open as openShp } from 'shapefile'
export async function readSHPFile(shp, dbf?) {
  let kq: any = [];
  await openShp(shp, dbf, {
    encoding: 'utf8'
  }).then(source => source.read()
    .then(function log(result) {
      if (result.done) return;
      kq.push(result.value)
      return source.read().then(log);
    }))
    .catch(error => console.error(error.stack));
  // await outputJSON('./tmp/data.json', kq)
  return kq;
}