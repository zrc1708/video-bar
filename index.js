(async function run() {
    var fs = require('fs')
    //加载依赖
    const Koa = require('koa'); //引入koa框架
    const Static = require('koa-static-cache'); //引入koa静态资源依赖
    const Router = require('koa-router'); //引入koa路由
    const Bodyparser = require('koa-bodyparser');//加载body解析依赖
    const cors = require('koa2-cors')//引入跨域依赖
    const koaBody = require('koa-body');

    const app = new Koa(); //类似于实例化
   
    app.use(koaBody({
        multipart: true,
        formidable: {
            maxFileSize: 10000*1024*1024    // 设置上传文件大小最大限制，默认100M
        }
    }));
    app.use(cors());//解决跨域问题
    
    app.use(Bodyparser())

    
    //加载静态资源
    app.use(Static('./static', {
        prefix: '/static',
        gzip: true
    }));

    
    const loginrouter = require('./loginrouter.js')

    app.use(loginrouter.routes());

    app.listen(8877, () => {
        console.log('服务器启动成功')
    });

})();