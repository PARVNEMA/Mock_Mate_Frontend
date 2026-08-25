export interface BlogUser {
  id: string;
  username?: string;
  profile_pic?: string;
  email?: string;
}

export interface BlogPost {
  id: string;
  title: string;
  content: string;
  images: string[];
  image?: string;
  visibility: "PUBLIC" | "PRIVATE";
  created_by: string;
  user?: BlogUser;
  likeCount: number;
  commentCount: number;
  likes: string[];
  comments: BlogComment[];
  created_at: string;
  updated_at: string;
}

export interface BlogComment {
  id: string;
  content: string;
  post_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  user?: BlogUser;
}

export interface BlogPlaylist {
  id: string;
  title: string;
  description: string;
  created_by: string;
  postCount: number;
  posts: BlogPost[];
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
  success: boolean;
}

export interface PaginatedPostsData {
  posts?: BlogPost[];
  count?: number;
  page?: number;
  limit?: number;
}

export interface PostsListResponse {
  count?: number;
  posts: BlogPost[];
}

export interface CommentsListResponse {
  count: number;
  comments: BlogComment[];
}

export interface PlaylistsListResponse {
  count: number;
  playlists: BlogPlaylist[];
}
