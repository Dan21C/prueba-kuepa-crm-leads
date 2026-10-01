import dotenv from 'dotenv'

dotenv.config()

export default {
  root: 'back',
  mode: 'dev',
  customs:{
    url: process.env.PUBLIC_URL || 'http://localhost:7001',
  },
  databases: {
    mongo:{
      dev: {
        uri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kuepa_test?retryWrites=true&w=majority&appName=Test'
      }
    }
  },
  jwt: process.env.JWT_SECRET || 'yp58Fkp-7wEnrklK98RRUZ75jcmV8SV_ln-fFn4s5DVSG_YRpD_gt_il1we0AwOdFpZ2e-2pyhR5eC46xU',
  port: Number(process.env.PORT) || 7001,
  public_url: process.env.PUBLIC_URL || 'http://localhost:7001'
}
