const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");
const bcrypt=require("bcrypt");
const jwt =require("jsonwebtoken");
const app = express();
app.use(express.json());
let db=null;
const initDbAndServer= async ()=>{
    try{
        db=await open({
            filename:dbPath,
            driver:sqlite3.Database,
        });
        app.listen(3000,()=>{console.log('Server running');});
    }catch(err)={
        console.log(`Error: ${err.message}`);
    }
};
initDbAndServer();
const authenticateToken=(request,response,next)=>{
    const {tweet}=request.body;
    const {tweetId}=request.params;
    let jwtToken;
    const authHeader=request.headers["authorization"];
    if(authHeader!==undefined){
        jwtToken=authHeader.split()[1];
    }
    if(jwtToken===undefined){
        response.status(401);
        response.send("Invalid JWT Token");
    }else{
        jwt.verify(jwtToken, "MY_SECRET_TOKEN",async(error,payload)=>{
            if(error){
                response.status(401);
                response.send("Invalid JWT Token");
            }else{
                request.payload=payload;
                request.tweetId=tweetId;
                request.tweet=tweet;
                next();
            }
        });
    }
};

app.post("/register/", async (request, response) => {
    const {username,password,name,gender}=request.body;
    const selectUser=`SELECT * FROM user WHERE username='${username}';`;
    const dbUser=await db.get(selectUser);
    if(dbUser===undefined){
        if(password.length<6){
            response.status(400);
            response.send("Password is too short");
        }else{
            const hashedPassword=await bcrypt.hash(password,10);
            const createUser=`INSERT INTO user(name,username,password,gender) VALUES '${name}','${username}','${hashedPassword}','${gender}';`;
            await db.run(createUser);
            response.status(200);
            response.send("User created successfully");
        }
    }else{
        response.status(400);
        response.send('User already exits');
    }
});
app.post("/login/", async (request, response) => {
    const {username,password}=request.body;
    const selectUser=`SELECT * FROM user WHERE username='${username}';`;
    const dbUser=await db.get(selectUser);
    if(dbUser===undefined){
        response.status(400);
        response.send('Invalid User');
    }else{
        const isPasswordMatched=await bcrypt.compare(password,dbUser.password);
        if(isPasswordMatched{
            const jwtToken=jwt.sign(dbUser,"MY_SECRET_TOKEN");
            response.send({jwtToken});
        }else{
            response.status(400);
        response.send('Invalid password');
        }
    }
});
app.get("/user/tweets/feed/",authenticateToken, async (request, response) => {
    const {payload}=request;
    const {user_id,name,username,gender}=payload;
    const getTweetsFeed=`SELECT username,tweet,date_time AS dateTime 
    FROM follower INNER JOIN tweet ON follower.following_user_id=tweet.user_id
    INNER JOIN user ON user.user_id=follower.following_user_id
     WHERE follower.follower_user_id=${user_id} ORDER BY date_time DESC LIMIT 4;`;
    const tweetFeed=await db.all(getTweetsFeed);
    response.send(tweetFeed);
});
app.get("/user/following/",authenticateToken, async (request, response) => {
    const {payload}=request;
    const {user_id,name,username,gender}=payload;
    const userFollows=`SELECT name FROM user INNER JOIN follower ON user.user_id=follower.following_user_id WHERE follower.follower_user_id=${user_id};`;
    const userFollowsArr=await db.all(userFollows);
    response.send(userFollowsArr);
});
app.get("/user/followers/",authenticateToken, async (request, response) => {
    const {payload}=request;
    const {user_id,name,username,gender}=payload;
    const userFollowers=`SELECT name FROM user INNER JOIN follower ON user.user_id=follower.follower_user_id WHERE follower.following_user_id=${user_id};`;
    const followers=await db.all(userFollowers);
    response.send(followers);
});
app.get("/tweets/:tweetId/", async (request, response) => {
    const {tweetId}=request;
    const {payload}=request;
    const {user_id,name,username,gender}=payload;
    const tweets=`SELECT * FROM tweet WHERE tweet_id=${tweetId} ;`;
    const tweetsResult=await db.get(tweets);
    
    const userFollowers=`SELECT * FROM follower INNER JOIN user ON user.user_id=follower.following_user_id WHERE follower.follower_user_id=${user_id};`;
    const userFollowersArr=await db.all(userFollowers);
    
    if(userFollowers.some(each=>each.following_user_id===tweetsResult.user_id)){
        const getTweetDetails=`SELECT tweet,COUNT(DISTINCT(like.like_id)) AS likes COUNT(DISTINCT(reply.reply_id)) AS replies tweet.date_time AS dateTime
         FROM tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id INNER JOIN reply ON reply.tweet_id=tweet.tweet_id 
         WHERE tweet.tweet_id=${tweet_id} AND tweet.user_id=${userFollowersArr[0].user_id};`;
        const tweetDetails=await db.get(getTweetDetails);
        response.send(tweetDetails);
    }else{
        response.status(401);
        response.send("Invalid Request");
    }
});
app.get("/tweets/:tweetId/likes/",authenticateToken, async (request, response) => {
    const {tweetId}=request;
    const {payload}=request;
    const {user_id,name,username,gender}=payload;
    const likedUsers=`SELECT * FROM follower INNER JOIN tweet ON tweet.user_id=follower.following_user_id 
    INNER JOIN like ON like.tweet_id=tweet.tweet_id INNER JOIN user ON user.user_id=like.user_id
     WHERE tweet.tweet_id=${tweetId} AND follower.follower_user_id=${user_id} ;`;
     const likedUsersArr=await db.all(likedUsers);
     if(likedUsersArr.length!==0){
         let likes=[];
         const getNamesArr=(likedUsersArr)=>{
             for (let each of likedUsersArr){
                 likes.push(each.username)
             }
         };
         getNamesArr(likedUsersArr);
         response.send({likes});
     }else{
         response.status(401);
         response.send("Invalid Request");
     }

});
app.get("/tweets/:tweetId/replies/",authenticateToken, async (request, response) => {
    const {tweetId}=request;
    const {payload}=request;
    const {user_id,name,username,gender}=payload;
    const getRepliedUsers=`SELECT * FROM follower INNER JOIN tweet ON tweet.user_id=follower.following_user_id 
    INNER JOIN reply ON reply.tweet_id=tweet.tweet_id  INNER JOIN user ON user.user_id=reply.user_id 
    WHERE tweet.tweet_id=${tweetId} AND follower.follower_user_id=${user_id} ;`;
    const repliedUsers=await db.all(getRepliedUsers);
    if(repliedUsers.length!==0){
        let replies=[];
        const getNames=(repliedUsers)=>{
            for(let each of repliedUsers){
                let obj={
                    name:each.name,
                    reply:each.reply,
                };
                replies.push(obj);
            }
        };
        getNames(repliedUsers);
        response.send({replies});
    }else{
        response.status(401);
        response.send("Invalid Request");
    }
});
app.get("/user/tweets/",authenticateToken, async (request, response) => {
    const {payload}=request;
    const {user_id,name,username,gender}=payload;
    const getTweetsDetails=`SELECT tweet.tweet AS tweet, COUNT(DISTINCT(like.like_id)) AS likes, COUNT(DISTINCT(reply.reply_id)) AS replies,tweet.date_time AS dateTime FROM user INNER JOIN tweet ON user.user_id=tweet.user_id 
        INNER JOIN like ON like.tweet_id=tweet.tweet_id INNER JOIN reply ON reply.tweet_id=tweet.tweet_id  
        WHERE user.user_id=${user_id} GROUP BY tweet.tweet-id;`;
    const tweetsDetails=await db.all(getTweetsDetails);
    response.send(tweetsDetails);
});
app.post("/user/tweets/",authenticateToken, async (request, response) => {
    const {tweet}=request;
    const {tweetId}=request;
    const {payload}=request;
    const {user_id,name,username,gender}=payload;
    const postTweet=`INSERT INTO tweet(tweet,user_id) VALUES ('${tweet}',${user_id});`;
    await db.run(postTweet);
    response.send("Created a Tweet"); 
});
app.delete("/tweets/:tweetId/",authenticateToken, async (request, response) => {
    const {tweetId}=request;
    const {payload}=request;
    const {user_id,name,username,gender}=payload;
    const selectUser=`SELECT * FROM tweet WHERE tweet.user_id=${user_id} AND tweet.tweet_id=${tweetId};`;
    const tweetUser= await db.all(selectUser);
    if(tweetUser.length!==0){
        const deleteTweet=`DELETE FROM tweet WHERE tweet.user_id=${user_id} AND tweet.tweet_id=${tweetId};`;
        await db.run(deleteTweet);
        response.send("Tweet Removed");
    }else{
        response.status(401);
        response.send("Invalid Request");
    }
});

module.exports= app;
