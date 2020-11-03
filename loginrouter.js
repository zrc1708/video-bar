const Router = require('koa-router')
const Mysql = require('mysql2/promise'); //引入mysql,mysql依赖
const mysql_nico = require('./mysql.js') // 导入数据库登录信息
const mime = require('mime-types');
const path = require('path');

// 语音合成相关
let AipSpeechClient  = require("baidu-aip-sdk").speech;
let fs = require('fs');

// 设置APPID/AK/SK
var APP_ID = "22919522";
var API_KEY = "NrkzF4QyjgBjmvXVAbit37EU";
var SECRET_KEY = "RQLvP9uaPGiBoTNUKaYs6ZSwPX0vIGhW";

// 新建一个对象，建议只保存一个对象调用服务接口
var client = new AipSpeechClient(APP_ID, API_KEY, SECRET_KEY);


const loginrouter = new Router()

// 语音合成接口
loginrouter.get('/getvoice', async ctx => {

    // 语音合成，保存到本地文件
    client.text2audio('妮可妮可妮', {
        spd: 5
    }).then(function (result) {
        if (result.data) {
            console.log('语音合成成功，文件保存到tts.mp3，打开听听吧');
            fs.writeFileSync('tts.mp3', result.data);
        } else {
            // 合成服务发生错误
            console.log('语音合成失败: ' + JSON.stringify(result));
        }
    }, function (err) {
        console.log(err);
    });

});

// 获取mp3接口
loginrouter.get('/getimage/:imageName', async (ctx, next) => {
    const imageName = ctx.params.imageName.trim()
    // 设置文件路径
    let filePath = path.join(__dirname)+'/'+imageName
	try {
	    //读取文件
        file = fs.readFileSync(filePath)
	} catch (error) {
		//如果服务器不存在请求的图片，返回默认图片
	    filePath = path.join(__dirname, '/404/404.png')
	    file = fs.readFileSync(filePath)    
    }
    //读取图片文件类型
    let mimeType = mime.lookup(filePath)
    //设置返回类型
    ctx.set('content-type', mimeType)
    //返回图片
	ctx.body = file
});

//登录接口
loginrouter.post('/login', async ctx => {
    const username = ctx.request.body.username
    const password = ctx.request.body.password
    
    const connection = await Mysql.createConnection(mysql_nico)
    const sql = `SELECT * FROM user WHERE username = '${username}' and password = '${password}'`;
    const [rs] = await connection.query(sql);
    connection.end(function (err) {})

    if (rs.length > 0) {
        ctx.body = {
            code: 200,
            tips: '登录成功',
            id: rs[0].id,
            isadmin:rs[0].isadm
        }
    } else {
        ctx.body = {
            code: 201,
            tips: '登录失败'
        }
    }
});

//注册接口
loginrouter.post('/register', async ctx => {
    const {username} = ctx.request.body
    const {password} = ctx.request.body
    const {sex} = ctx.request.body
    const {age} = ctx.request.body
    const {email} = ctx.request.body
    
    const connection = await Mysql.createConnection(mysql_nico)
    const sql = `INSERT INTO user ( username, password , isadm , sex , age , email ) 
                VALUES ( '${username}', '${password}', 0, ${sex} , ${age} ,'${email}');`;
    const [rs] = await connection.query(sql);
    connection.end(function (err) {})

    if (rs.affectedRows == 1) {
        ctx.body = {
            code: 200,
            tips: '注册成功'
        }
    } else {
        ctx.body = {
            code: 201,
            tips: '注册失败'
        }
    }
});

module.exports = loginrouter