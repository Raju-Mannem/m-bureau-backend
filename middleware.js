import jsonwebtoken from 'jsonwebtoken';
 function middleware(req,res,next){
    try{
        let token=req.header('x-token');
        if(!token){
            return res.status(400).send('token not foound');
        }
        let decode=jsonwebtoken.verify(token,'jwtsecret');
        req.user=decode.user;
        next();
    }
    catch(err){
        console.log(err);
        return res.status(500).send('internall server error');
    }
 }
 export default middleware;