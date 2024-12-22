
const checkSession=(req,res,next)=>{
    if(req.session.admin){
        return next()
    }else{
        res.redirect('/admin/login')
    }
}

const isLogin=(req,res,next)=>{
    if(req.session.admin){
        res.redirect('/admin/home')
    }else{
        next()
    }
}

module.exports={checkSession,isLogin}