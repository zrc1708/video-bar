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
loginrouter.get('/getvoice/:voiceName', async (ctx, next) => {
    const voiceName = ctx.params.voiceName.trim()
    // 设置文件路径
    let filePath = path.join(__dirname)+'/mp3/'+voiceName
	
    //读取文件
    file = fs.readFileSync(filePath)
	
    //读取图片文件类型
    let mimeType = mime.lookup(filePath)
    //设置返回类型
    ctx.set('content-type', mimeType)
    //返回
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
    const time = new Date().Format("yyyy-MM-dd hh:mm:ss");

    const connection = await Mysql.createConnection(mysql_nico)
    let sql = `INSERT INTO user ( username, password , isadm , sex , age , email ,birthtime) 
                VALUES ( '${username}', '${password}', 0, ${sex} , ${age} ,'${email}','${time}');`;
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
    await client.text2audio(content, {
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

// 获取所有文章接口
loginrouter.get('/getallarticles', async ctx => {
    
    const connection = await Mysql.createConnection(mysql_nico)
    const sql = `Select article.id,article.title,article.content,article.commits,
                article.views, article.voice, article.posttime, article.userid,
                user.username ,user.sex ,user.age ,user.age ,user.email ,user.birthtime,
                avatar.filename
                from article ,user ,avatar 
                where article.userid = user.id and article.userid = avatar.userid
                order by article.id desc;`
    const [rs] = await connection.query(sql);
    connection.end(function (err) {})

    if (rs) {
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

// 获取用户所有文章接口
loginrouter.get('/getmyarticle/:id', async ctx => {
    let id = ctx.params.id
    
    const connection = await Mysql.createConnection(mysql_nico)
    const sql = `Select * from article where userid = ${id} order by id desc;`
    const [rs] = await connection.query(sql);
    connection.end(function (err) {})

    if (rs) {
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

// 通过id获取文章接口
loginrouter.get('/getarticle/:id', async ctx => {
    let id = ctx.params.id
    const connection = await Mysql.createConnection(mysql_nico)
    const sql = `Select article.id,article.title,article.content,article.commits,
                article.views, article.voice, article.posttime, article.userid,
                user.username ,user.sex ,user.age ,user.age ,user.email ,user.birthtime,
                avatar.filename
                from article ,user ,avatar 
                where article.userid = user.id and article.userid = avatar.userid and article.id = ${id};`
    const [rs] = await connection.query(sql);
    connection.end(function (err) {})

    if (rs) {
        ctx.body = {
            code: 200,
            tips: '获取文章成功',
            rs
        }
    } else {
        ctx.body = {
            code: 201,
            tips: '获取文章失败'
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
    let file = ctx.request.files.file
    const filename = Date.now()+''+Math.floor(Math.random()*10)+'.webp'

    // 保存文件
    const reader = fs.createReadStream(file.path);
    let filePath = path.join(__dirname+'/images') + `/${filename}`;
    const upStream = fs.createWriteStream(filePath);
    reader.pipe(upStream);

    const {id} = ctx.request.body
    const {haveAvatar} = ctx.request.body

    // // 将文件信息写入数据库
    const connection = await Mysql.createConnection(mysql_nico)
    let sql
    if(haveAvatar === 'true'){
        // 如果用户有之前有头像，更新数据库
        sql = `UPDATE avatar SET filename = '${filename}' WHERE userid = ${id};`
        // 删除旧头像
        const {oldFileName} = ctx.request.body
        fs.unlink(path.join(__dirname+'/images') + `/${oldFileName}`, (err) => {
            if(err) throw err;
        });
    }else{
        // 如果用户没有头像，插入数据库
        sql = `INSERT INTO avatar (filename, userid) VALUES ( '${filename}', ${id});`
    }
    const [rs] = await connection.query(sql);
    connection.end(function(err){})

    if (rs.affectedRows == 1) {
        ctx.body = {
            code: 200,
            tips: '上传成功',
            filename
        }
    } else {
        ctx.body = {
            code: 201,
            tips: '上传失败'
        }
    }
});

// 根据id获取用户头像
loginrouter.get('/getimagename/:id', async (ctx, next) => {
    const id = ctx.params.id.trim()
        
    const connection = await Mysql.createConnection(mysql_nico)
    const sql = `Select * from avatar where userid = ${id};`
    const [rs] = await connection.query(sql);
    connection.end(function (err) {})

    if (rs.length>0) {
        ctx.body = {
            code: 200,
            tips: '获取头像成功',
            rs:rs[0]
        }
    } else {
        ctx.body = {
            code: 210,
            tips: '此用户没有上传过头像'
        }
    }
});

// 获取图片接口
loginrouter.get('/getimage/:imageName', async (ctx, next) => {
    const imageName = ctx.params.imageName.trim()
    // 设置文件路径
    let filePath = path.join(__dirname)+'/images/'+imageName

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

// 文章增加阅读量接口
loginrouter.get('/addviews/:id/:views', async (ctx, next) => {
    const id = ctx.params.id
    const views = ctx.params.views
    
    const connection = await Mysql.createConnection(mysql_nico)
    const sql = `UPDATE article SET views = '${Number(views)+1}' WHERE id = ${id};`
    const [rs] = await connection.query(sql);
    connection.end(function(err){})

    ctx.body = {
        code: 200,
        tips: 'ok'
    }
});

// 评论发表接口
loginrouter.post('/publishcommit', async ctx => {
    const {content} = ctx.request.body
    const {userid} = ctx.request.body    
    const {articleid} = ctx.request.body    
    const {commits} = ctx.request.body    
    const time = new Date().Format("yyyy-MM-dd hh:mm:ss");
    const filename = Date.now()+''+Math.floor(Math.random()*10)+'.mp3'

    const connection = await Mysql.createConnection(mysql_nico)

    // 获取用户的语音设置
    let sql = `SELECT * FROM voicesetting WHERE userid = '${userid}';`
    const [rs] = await connection.query(sql);

    // 语音合成，保存到本地文件
    await client.text2audio(content, {
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
    sql = `INSERT INTO commit ( content , voice , posttime ,userid ,articleid) 
                VALUES ('${content}','${filename}','${time}',${userid},${articleid});`;
    const [rss] = await connection.query(sql);

    // 跟新文章与评论相关的内容
    sql = `UPDATE article SET commits = '${Number(commits)+1}' ,
            latestcommit='${new Date().Format("yyyy-MM-dd hh:mm:ss")}' WHERE id = ${articleid};`
    const [rsss] = await connection.query(sql);

    connection.end(function (err) {})

    if (rss.affectedRows == 1) {
        ctx.body = {
            code: 200,
            tips: '评论成功'
        }
    } else {
        ctx.body = {
            code: 201,
            tips: '评论失败'
        }
    }
});

// 获取文章评论接口
loginrouter.get('/getcommits/:id', async (ctx, next) => {
    const id = ctx.params.id
    
    const connection = await Mysql.createConnection(mysql_nico)
    const sql = `Select commit.id,commit.content,
                commit.voice, commit.posttime, commit.userid,commit.articleid,
                user.username ,user.sex ,user.age ,user.age ,user.email ,user.birthtime,
                avatar.filename
                from commit ,user ,avatar 
                where commit.userid = user.id and commit.userid = avatar.userid and commit.articleid = ${id}
                order by commit.id desc;`
    const [rs] = await connection.query(sql);
    connection.end(function(err){})

    ctx.body = {
        code: 200,
        tips: 'ok',
        rs
    }
});

module.exports = loginrouter