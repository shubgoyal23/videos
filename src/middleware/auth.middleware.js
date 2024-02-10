import jwt from "jsonwebtoken";
import {ApiError} from "../utils/ApiError.js";
import {asyncHandler} from "../utils/asyncHandler.js";
import {User} from "../models/Users.model.js";

export const verifyJwt = asyncHandler(async (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorisation")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "unauthorised request");
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );

    if (!user) {
      throw new ApiError(401, "Invalid access Token");
    }

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(404, error?.message || "invalid access token");
  }
});
