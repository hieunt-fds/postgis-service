import postgres from 'postgres'

const sql = postgres({
  host: process.env.HOST_POSTGRE,
  port: Number(process.env.PORT_POSTGRE),
  db: process.env.DB,
  user: process.env.USER_POSTGRE,
  password: process.env.PASSWORD_POSTGRE,
})

export default sql