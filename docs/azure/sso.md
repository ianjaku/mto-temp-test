
# Overview

Azure SSO lets users sign in to our application using there Azure login and password. When a user access the `/azure-sso-login` endpoint, we send a redirect back to the browser containing a SAML request (encoded in the redirect URL). The browser will follow the redirect to an Azure endpoint that will validate the user login and password. If the user is already signed in, the user has nothing to do. If the user is not logged in (s)he will need to provide a valid login and password. After successful validation, the Azure endpoint will reply with a second redirect to our servers containing a SAML response we can validate and extract user information from.


# Terminology and configuration

The Azure SSO has a ton of configuration options and domain specific terms. Here are a few:

*  *Identity metadata* Represents the capabilities and some configuration details of the different Azure SSO endpoints. Represented by an URL. (e.g. https://login.microsoftonline.com/common/.well-known/openid-configuration)

*  *Client ID* String representing your application on the Azure platform. Before you can use Azure SSO you need to create register your application with Azure Active Directory. Each registered application gets a unique client ID. The configuration also contains the endpoint to which the validated request will be redirected.

*  *ResponseType* You can use Azure SSO for authentication only, or also request an additional access token (usefull for doing API calls using a `Bearer` token)

*  *RedirectURL* You specify the endpoint where the redirect after successful login is sent. Should be the same as the redirectURL you registered for your application (on Azure AD)

For more details see `https://github.com/AzureAD/passport-azure-ad`

