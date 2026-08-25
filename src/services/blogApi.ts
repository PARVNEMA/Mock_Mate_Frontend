import axios from "axios";
import type {
  ApiResponse,
  BlogPost,
  BlogComment,
  BlogPlaylist,
  CommentsListResponse,
  PlaylistsListResponse,
  PostsListResponse,
} from "../types/blog";

const getBackendUrl = (): string => {
  const url = String(import.meta.env.VITE_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
  return url;
};

const getCleanToken = (): string => {
  const raw = localStorage.getItem("accessToken");
  const token = String(raw || "").trim();
  if (!token || token === "undefined" || token === "null") {
    return "";
  }
  return token;
};

const getAuthHeaders = () => {
  const token = getCleanToken();
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

// ----------------------------------------------------------------------------
// POSTS API
// ----------------------------------------------------------------------------

export const getAllPosts = async (
  page: number = 1,
  limit: number = 10
): Promise<BlogPost[]> => {
  const response = await axios.get<ApiResponse<any>>(
    `${getBackendUrl()}/api/v1/posts/?page=${page}&limit=${limit}`,
    getAuthHeaders()
  );
  const data = response.data.data;
  if (Array.isArray(data)) return data;
  if (data?.posts && Array.isArray(data.posts)) return data.posts;
  return [];
};

export const getMyPosts = async (): Promise<BlogPost[]> => {
  const response = await axios.get<ApiResponse<PostsListResponse>>(
    `${getBackendUrl()}/api/v1/posts/myPosts`,
    getAuthHeaders()
  );
  return response.data.data?.posts || [];
};

export const getLikedPosts = async (): Promise<string[]> => {
  const response = await axios.get<ApiResponse<{ posts: string[] }>>(
    `${getBackendUrl()}/api/v1/posts/getLikes`,
    getAuthHeaders()
  );
  return response.data.data?.posts || [];
};

export const getPostById = async (id: string): Promise<BlogPost> => {
  const response = await axios.get<ApiResponse<BlogPost>>(
    `${getBackendUrl()}/api/v1/posts/${id}`,
    getAuthHeaders()
  );
  return response.data.data;
};

export const createPost = async (
  title: string,
  content: string,
  visibility: "PUBLIC" | "PRIVATE" = "PUBLIC",
  images: File[] = []
): Promise<BlogPost> => {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("content", content);
  formData.append("visibility", visibility);
  images.forEach((file) => {
    formData.append("images", file);
  });

  const token = getCleanToken();
  const response = await axios.post<ApiResponse<BlogPost>>(
    `${getBackendUrl()}/api/v1/posts/create`,
    formData,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return response.data.data;
};

export const updatePost = async (
  id: string,
  title?: string,
  content?: string,
  visibility?: "PUBLIC" | "PRIVATE",
  images: File[] = []
): Promise<BlogPost> => {
  const formData = new FormData();
  if (title !== undefined) formData.append("title", title);
  if (content !== undefined) formData.append("content", content);
  if (visibility !== undefined) formData.append("visibility", visibility);
  images.forEach((file) => {
    formData.append("images", file);
  });

  const token = getCleanToken();
  const response = await axios.patch<ApiResponse<BlogPost>>(
    `${getBackendUrl()}/api/v1/posts/${id}`,
    formData,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return response.data.data;
};

export const deletePost = async (id: string): Promise<boolean> => {
  const response = await axios.delete<ApiResponse<any>>(
    `${getBackendUrl()}/api/v1/posts/${id}`,
    getAuthHeaders()
  );
  return response.data.success;
};

export const toggleLikePost = async (id: string): Promise<any> => {
  const response = await axios.get<ApiResponse<any>>(
    `${getBackendUrl()}/api/v1/posts/toggleLike/${id}`,
    getAuthHeaders()
  );
  return response.data.data;
};

export const generatePostContent = async (prompt: string): Promise<string> => {
  const response = await axios.post<ApiResponse<any>>(
    `${getBackendUrl()}/api/v1/posts/generateContent`,
    { prompt },
    getAuthHeaders()
  );
  const data = response.data.data;
  if (typeof data === "string") return data;
  if (data?.content) return data.content;
  return JSON.stringify(data);
};

// ----------------------------------------------------------------------------
// COMMENTS API
// ----------------------------------------------------------------------------

export const getCommentsByPostId = async (postId: string): Promise<BlogComment[]> => {
  const response = await axios.get<ApiResponse<CommentsListResponse>>(
    `${getBackendUrl()}/api/v1/comments/post/${postId}`,
    getAuthHeaders()
  );
  return response.data.data?.comments || [];
};

export const addComment = async (postId: string, content: string): Promise<BlogComment> => {
  const response = await axios.post<ApiResponse<BlogComment>>(
    `${getBackendUrl()}/api/v1/comments/post/${postId}`,
    { content },
    getAuthHeaders()
  );
  return response.data.data;
};

export const updateComment = async (commentId: string, content: string): Promise<BlogComment> => {
  const response = await axios.patch<ApiResponse<BlogComment>>(
    `${getBackendUrl()}/api/v1/comments/${commentId}`,
    { content },
    getAuthHeaders()
  );
  return response.data.data;
};

export const deleteComment = async (commentId: string): Promise<boolean> => {
  const response = await axios.delete<ApiResponse<any>>(
    `${getBackendUrl()}/api/v1/comments/${commentId}`,
    getAuthHeaders()
  );
  return response.data.success;
};

// ----------------------------------------------------------------------------
// PLAYLISTS API
// ----------------------------------------------------------------------------

export const getAllPlaylists = async (): Promise<BlogPlaylist[]> => {
  const response = await axios.get<ApiResponse<PlaylistsListResponse>>(
    `${getBackendUrl()}/api/v1/playlists/`,
    getAuthHeaders()
  );
  return response.data.data?.playlists || [];
};

export const getPlaylistById = async (id: string): Promise<BlogPlaylist> => {
  const response = await axios.get<ApiResponse<BlogPlaylist>>(
    `${getBackendUrl()}/api/v1/playlists/${id}`,
    getAuthHeaders()
  );
  return response.data.data;
};

export const createPlaylist = async (
  title: string,
  description: string = ""
): Promise<BlogPlaylist> => {
  const response = await axios.post<ApiResponse<BlogPlaylist>>(
    `${getBackendUrl()}/api/v1/playlists/create`,
    { title, description },
    getAuthHeaders()
  );
  return response.data.data;
};

export const updatePlaylist = async (
  id: string,
  title?: string,
  description?: string
): Promise<BlogPlaylist> => {
  const response = await axios.patch<ApiResponse<BlogPlaylist>>(
    `${getBackendUrl()}/api/v1/playlists/${id}`,
    { title, description },
    getAuthHeaders()
  );
  return response.data.data;
};

export const deletePlaylist = async (id: string): Promise<boolean> => {
  const response = await axios.delete<ApiResponse<any>>(
    `${getBackendUrl()}/api/v1/playlists/${id}`,
    getAuthHeaders()
  );
  return response.data.success;
};

export const addPostToPlaylist = async (
  playlistId: string,
  postId: string
): Promise<BlogPlaylist> => {
  const response = await axios.post<ApiResponse<BlogPlaylist>>(
    `${getBackendUrl()}/api/v1/playlists/add/${playlistId}`,
    { postId },
    getAuthHeaders()
  );
  return response.data.data;
};

export const removePostFromPlaylist = async (
  playlistId: string,
  postId: string
): Promise<BlogPlaylist> => {
  const token = getCleanToken();
  const response = await axios.delete<ApiResponse<BlogPlaylist>>(
    `${getBackendUrl()}/api/v1/playlists/remove/${playlistId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: { postId },
    }
  );
  return response.data.data;
};
