const asyncHandler = (fun) => {
    return (req, res, next) => {
        Promise.resolve(fun(req, res, next)).catch(error => next(error))
    }
}

export {asyncHandler}

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