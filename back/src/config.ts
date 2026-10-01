export default {
  root: 'back',
  mode: 'dev',
  customs:{
    url: 'http://localhost:7001',
  },
  databases: {
    mongo:{
      dev: {
        uri: 'mongodb://127.0.0.1:27017/kuepa_test?retryWrites=true&w=majority&appName=Test'
      }
    }
  },
  jwt: 'yp58Fkp-7wEnrklK98RRUZ75jcmV8SV_ln-fFn4s5DVSG_YRpD_gt_il1we0AwOdFpZ2e-2pyhR5eC46xU',
  port: 7001,
  public_url: 'http://localhost:7001'
}