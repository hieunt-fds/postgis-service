import jsonwebtoken from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET

export const verify = async (token: string) => {
  return await jsonwebtoken.verify(
    token,
    JWT_SECRET,
    function (err: any, decoded: Object) {
      if (err) {
        return {
          status: 403,
          message: 'Invalid token'
        };
      }
      return decoded;
    },
  );
};