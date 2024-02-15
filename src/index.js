import connectDb from "./db/index.js";
import dotenv from 'dotenv'
import {app} from './app.js' 


dotenv.config({
    path: "./.env"
})



connectDb()
.then(()=>{
    app.on("Error", (error)=> {
        console.log("there is an error", error)
        throw error
    })
    app.listen(process.env.PORT, ()=>{
        console.log(`Server started at port http://localhost:${process.env.PORT}`)
    })
})
.catch(err => console.log("mongodb connection failed", err))