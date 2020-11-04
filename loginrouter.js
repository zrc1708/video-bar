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


Date.prototype.Format = function (fmt) { // author: meizz
    var o = {
        "M+": this.getMonth() + 1, // 月份
        "d+": this.getDate(), // 日
        "h+": this.getHours(), // 小时
        "m+": this.getMinutes(), // 分
        "s+": this.getSeconds(), // 秒
        "q+": Math.floor((this.getMonth() + 3) / 3), // 季度
        "S": this.getMilliseconds() // 毫秒
    };
    if (/(y+)/.test(fmt))
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
            return fmt;
}


const loginrouter = new Router()

// 语音合成接口
// loginrouter.get('/getvoice', async ctx => {

//     // 语音合成，保存到本地文件
//     client.text2audio('妮可妮可妮', {
//         spd: 5
//     }).then(function (result) {
//         if (result.data) {
//             console.log('语音合成成功，文件保存到tts.mp3，打开听听吧');
//             fs.writeFileSync('mp3/tts.mp3', result.data);
//         } else {
//             // 合成服务发生错误
//             console.log('语音合成失败: ' + JSON.stringify(result));
//         }
//     }, function (err) {
//         console.log(err);
//     });

// });

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
            username:rs[0].username,
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
    let sql = `INSERT INTO user ( username, password , isadm , sex , age , email ) 
                VALUES ( '${username}', '${password}', 0, ${sex} , ${age} ,'${email}');`;
    const [rs] = await connection.query(sql);

    // 为新用户初始化语音设置
    sql = `INSERT INTO voicesetting ( userid ) VALUES ('${rs.insertId}');`;
    const [rss] = await connection.query(sql);

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

// 文章发表接口
loginrouter.post('/publish', async ctx => {
    const {title} = ctx.request.body
    const {content} = ctx.request.body
    const {id} = ctx.request.body    
    const time = new Date().Format("yyyy-MM-dd hh:mm:ss");
    const filename = Date.now()+''+Math.floor(Math.random()*10)+'.mp3'


    const connection = await Mysql.createConnection(mysql_nico)

    // 获取用户的语音设置
    let sql = `SELECT * FROM voicesetting WHERE userid = '${id}';`
    const [rs] = await connection.query(sql);

    // 语音合成，保存到本地文件
    client.text2audio(content, {
        per: rs[0].per,
        spd: rs[0].spd,
        pit: rs[0].pit,
        vol: rs[0].vol,
    }).then(function (result) {
        if (result.data) {
            fs.writeFileSync(`mp3/${filename}`, result.data);
        } else {
            console.log('语音合成失败: ' + JSON.stringify(result));
        }
    }, function (err) {
        console.log(err);
    });

    // 插入数据库
    sql = `INSERT INTO article ( title, content , voice , posttime ,userid) 
                VALUES ( '${title}', '${content}', '${filename}' , '${time}',${id});`;
    const [rss] = await connection.query(sql);
    connection.end(function (err) {})

    if (rss.affectedRows == 1) {
        ctx.body = {
            code: 200,
            tips: '发表成功'
        }
    } else {
        ctx.body = {
            code: 201,
            tips: '发表失败'
        }
    }
});

// 获取用户所有文章接口
loginrouter.get('/getmyarticle/:id', async ctx => {
    let id = ctx.params.id
    
    const connection = await Mysql.createConnection(mysql_nico)
    const sql = `Select * from article where userid = ${id};`
    const [rs] = await connection.query(sql);
    connection.end(function (err) {})

    if (rs.length > 0) {
        ctx.body = {
            code: 200,
            tips: '获取设置成功',
            rs
        }
    } else {
        ctx.body = {
            code: 201,
            tips: '获取设置失败'
        }
    }
});

// 获取用户语音设置接口
loginrouter.get('/getvoicesetting/:id', async ctx => {
    let id = ctx.params.id
    
    const connection = await Mysql.createConnection(mysql_nico)
    const sql = `Select * from voicesetting where userid = ${id};`
    const [rs] = await connection.query(sql);
    connection.end(function (err) {})

    if (rs.length > 0) {
        ctx.body = {
            code: 200,
            tips: '获取设置成功',
            rs:rs[0]
        }
    } else {
        ctx.body = {
            code: 201,
            tips: '获取设置失败'
        }
    }
});

// 修改用户语音设置接口
loginrouter.post('/changevoicesetting', async ctx => {
    const {per} = ctx.request.body
    const {spd} = ctx.request.body
    const {pit} = ctx.request.body
    const {vol} = ctx.request.body
    const {id} = ctx.request.body

    const connection = await Mysql.createConnection(mysql_nico)
    const sql = `UPDATE voicesetting SET per = ${per} , spd = ${spd} ,
                pit = ${pit} , vol = ${vol}  WHERE userid = '${id}';`
    const [rs] = await connection.query(sql);
    connection.end(function (err) {})

    if (rs.affectedRows == 1) {
        ctx.body = {
            code: 200,
            tips: '修改成功',
        }
    } else {
        ctx.body = {
            code: 201,
            tips: '修改失败'
        }
    }
});

// 头像上传接口
loginrouter.post('/uploadimage', async (ctx, next) => {
    console.log(ctx.request.files.file);
    let file = ctx.request.files.file
    // let file,fileNames
    // // 获取保存文件用的文件名, 获取文件
    // if(ctx.request.files.file.length){
    //     file = [...ctx.request.files.file]
    // }else{
    //     file = [ctx.request.files.file]
    // }
    // fileNames = [...ctx.request.body.fileNames.split(',')]

    const filename = Date.now()+''+Math.floor(Math.random()*10)+'.webp'
    // 保存文件
    // 创建可读流
    const reader = fs.createReadStream(file.path);
    let filePath = path.join(__dirname+'/images') + `/${filename}`;
    // 创建可写流
    const upStream = fs.createWriteStream(filePath);
    // 可读流通过管道写入可写流
    reader.pipe(upStream);

    // var imageUrl = []
    // // 将文件信息写入数据库
    // const connection = await Mysql.createConnection(mysql_nico)
    // fileNames.forEach(async (item)=>{
    //     let filepath = path.join(__dirname+'/images')+ `/${item}`
    //     // 顺便生成图片文件的访问地址
    //     let url = baseurl+'/getimage/'+item
    //     imageUrl.push(url)
    //     const sql = `INSERT INTO image (filename, path,url) VALUES ( '${item}', '${filepath}','${url}');`
    //     const [rs] = await connection.query(sql);
    // })
    // connection.end(function(err){})

    return ctx.body = {
        message:"上传成功！",
        code:200,
    };
});
module.exports = loginrouter