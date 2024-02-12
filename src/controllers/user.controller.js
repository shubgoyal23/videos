import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/Users.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateRefreshTokenAndAccessToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({validateBeforeSave: false});

    return {accessToken, refreshToken};
  } catch (error) {
    throw new ApiError(
      500,
      "something went wrong while generating access and refresh token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const {fullname, email, password, username} = req.body;

  if (
    [fullname, email, password, username].some(
      (feild) => feild?.trim() === "" || feild?.trim() === undefined
    )
  ) {
    throw new ApiError(400, "All feilds are required");
  }

  const userExisted = await User.findOne({
    $or: [{username}, {email}],
  });

  if (userExisted) {
    throw new ApiError(409, "User with username or email Already existed");
  }

  const avatarLocatpath = req.files?.avatar[0]?.path;
  // const coverImageLocatpath = req.files?.coverImage[0]?.path;
  if (!avatarLocatpath) {
    throw new ApiError(400, "Aavtar file is required");
  }
  const avatar = await uploadOnCloudinary(avatarLocatpath);

  let coverImageLocatpath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocatpath = req.files.coverImage[0].path;
  }
  let coverImage;

  if (coverImageLocatpath) {
    coverImage = await uploadOnCloudinary(coverImageLocatpath);
  }

  if (!avatar) {
    throw new ApiError(500, "Avatar file upload failed");
  }

  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const userCreated = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!userCreated) {
    throw new ApiError(500, "something went wrong while creating user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, userCreated, "user registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const {username, email, password} = req.body;
  if (!username && !email) {
    throw new ApiError(400, "Email or Username required");
  }

  const user = await User.findOne({
    $or: [{username}, {email}],
  });

  if (!user) {
    throw new ApiError(404, "user not found");
  }

  const isPasswordVaild = await user.isPasswordCorrect(password); // here we user user which we got from findbyit because it has these methods we created them

  if (!isPasswordVaild) {
    throw new ApiError(401, "invalid password");
  }

  const {accessToken, refreshToken} = await generateRefreshTokenAndAccessToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpsOnly: true, //cookies can be only set by server only and user cant edit it
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {user: loggedInUser, accessToken, refreshToken},
        "user loggedin sucessfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {refreshToken: 1},
    },
    {new: true}
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "user logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incommingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incommingRefreshToken) {
    throw new ApiError(401, "unauthorise request");
  }

  try {
    const decodedToken = jwt.verify(
      incommingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incommingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }
    const options = {
      httpOnly: true,
      secure: true,
    };
    const {accessToken, refreshToken} =
      await generateRefreshTokenAndAccessToken(user._id);

    res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken,
          },
          "Access Token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const {oldPassword, newPassword} = req.body;

  const user = await User.findById(req.body?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "invalid current password");
  }
  if (!newPassword) {
    throw new ApiError(400, "invalid new password");
  }

  user.password = newPassword;
  await user.save({validateBeforeSave: false});

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fetched sucessfully"));
});

const updateUserDetails = asyncHandler(async (req, res) => {
  const {username, email} = req.body;
  if (!username || !email) {
    throw new ApiError(400, "username and email is required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname,
        email,
      },
    },
    {new: true}
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account Details updated sucessfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarpath = req.file?.avatar[0];
  if (!avatarpath) {
    throw new ApiError(400, "Avarat file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarpath);
  if (!avatar.url) {
    throw new ApiError(400, "erro while uploadin Avatar file");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {$set: {avatar: avatar.url}},
    {new: true}
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar file updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverfile = req.file?.coverImage[0];
  if (!coverfile) {
    throw new ApiError(400, "Cover Image is Required");
  }
  const coverUpload = uploadOnCloudinary(coverfile);
  if (!coverUpload.url) {
    throw new ApiError(400, "cover image upload failed");
  }

  const user = User.findByIdAndUpdate(
    req.user?._id,
    {$set: {coverImage: coverUpload.url}},
    {new: true}
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "cover image updated sucessfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const {username} = req.params;
  if (!username?.trim()) {
    throw new ApiError(400, "invalid username");
  }
  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTO",
      },
    },
    {
      $addFields: {
        subscriberCount: {
          $size: "$subscribers",
        },
        channelSubscribedToCount: {
          $size: "$subscribedTO",
        },
        isSubscribed: {
          $cond: {
            if: {$in: [req.user?._id, "$subscribers.subscriber"]},
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullname: 1,
        username: 1,
        subscriberCount: 1,
        channelSubscribedToCount: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);
  if (!channel?.length) {
    throw new ApiError(404, "channel does not exists");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "user channel fetched successfully")
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "Video",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullname: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateUserDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
