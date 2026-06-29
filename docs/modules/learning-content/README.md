# Learning Content Module

Admin video upload korte parbe category, title, ebong description diye. User-ra ei content gulo browse korte parbe, like korte parbe ebong comment korte parbe.

## Flow Summary

1. **Admin Content Management**: Admin `POST /learning-contents` use kore new video upload kore.
2. **User Discovery**: User `GET /learning-contents` use kore shob content list dekhte paye.
3. **Engagement**: User content like korte pare (`POST /.../like`) ebong comment/reply korte pare (`POST /.../comments`).

## Endpoints

| # | Endpoint | Description |
|---|---|---|
| 01 | [Create Content](./01-create-content.md) | Admin create learning content |
| 02 | [List Contents](./02-list-contents.md) | Browse learning contents |
| 03 | [Get Single Content](./03-get-content.md) | Detailed view of a content |
| 04 | [Update Content](./04-update-content.md) | Admin update content |
| 05 | [Delete Content](./05-delete-content.md) | Admin delete content |
| 06 | [Like Content](./06-like-content.md) | Toggle like on content |
| 07 | [Add Comment](./07-add-comment.md) | Add comment or reply |
| 08 | [List Comments](./08-list-comments.md) | Get comments for a content |
| 09 | [Delete Comment](./09-delete-comment.md) | Delete own or admin delete any comment |
