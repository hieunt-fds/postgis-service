import express from 'express';
const router = express.Router();
import sql from '@db/postgre'
async function getUsersOver() {
  const users = await sql`
    select *
    from dia_phan_tinh
  `
  return users
}

router.post('/ping', async function (_req, res) {
  res.status(200).send("Service is up and running!")
})

router.post('/connect', async function (_req, res) {
  sql.begin(sql => {

  })
  res.status(200).send(await getUsersOver())
})
export default router