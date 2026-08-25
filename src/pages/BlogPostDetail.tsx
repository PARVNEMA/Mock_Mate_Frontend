import React, { useEffect, useState } from "react";
import {
  Typography,
  Button,
  Tag,
  Avatar,
  Card,
  Input,
  List,
  Popconfirm,
  Spin,
  message,
  Divider,
} from "antd";
import {
  ArrowLeftOutlined,
  LikeOutlined,
  LikeFilled,
  FolderAddOutlined,
  UserOutlined,
  SendOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import {
  getPostById,
  toggleLikePost,
  deletePost,
  getCommentsByPostId,
  addComment,
  updateComment,
  deleteComment,
  getLikedPosts,
} from "../services/blogApi";
import type { BlogPost, BlogComment } from "../types/blog";
import AddToPlaylistModal from "../components/AddToPlaylistModal";
import CreatePostModal from "../components/CreatePostModal";
import { useAuth } from "../context/AuthContext";

const { Title, Text, Paragraph } = Typography;

const BlogPostDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId } = useAuth();

  const [post, setPost] = useState<BlogPost | null>(null);
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [commentText, setCommentText] = useState<string>("");
  const [postingComment, setPostingComment] = useState<boolean>(false);

  // Edit Comment State
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState<string>("");

  // Modals
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [editPostModalOpen, setEditPostModalOpen] = useState(false);

  const fetchPostDetails = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getPostById(id);
      setPost(data);

      // Check liked status
      try {
        const likedList = await getLikedPosts();
        setIsLiked(likedList.includes(id));
      } catch {
        // Ignore unauth
      }

      // Fetch comments
      try {
        const comms = await getCommentsByPostId(id);
        setComments(comms);
      } catch (err) {
        console.error("Error fetching comments:", err);
      }
    } catch (err: any) {
      console.error(err);
      message.error(err.response?.data?.message || "Failed to load post.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPostDetails();
  }, [id]);

  const handleToggleLike = async () => {
    if (!post) return;
    try {
      await toggleLikePost(post.id);
      setIsLiked(!isLiked);
      setPost((prev) =>
        prev
          ? {
              ...prev,
              likeCount: isLiked ? Math.max(0, prev.likeCount - 1) : prev.likeCount + 1,
            }
          : null
      );
    } catch (err: any) {
      message.error(err.response?.data?.message || "Please login to like post.");
    }
  };

  const handleDeletePost = async () => {
    if (!post) return;
    try {
      await deletePost(post.id);
      message.success("Post deleted.");
      navigate("/blog");
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to delete post.");
    }
  };

  const handleAddComment = async () => {
    if (!id || !commentText.trim()) return;
    setPostingComment(true);
    try {
      const newComm = await addComment(id, commentText);
      message.success("Comment added!");
      setCommentText("");
      setComments((prev) => [newComm, ...prev]);
      if (post) {
        setPost({ ...post, commentCount: (post.commentCount || 0) + 1 });
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to post comment.");
    } finally {
      setPostingComment(false);
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editingCommentText.trim()) return;
    try {
      const updated = await updateComment(commentId, editingCommentText);
      message.success("Comment updated.");
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, content: updated.content } : c))
      );
      setEditingCommentId(null);
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to update comment.");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      message.success("Comment removed.");
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      if (post) {
        setPost({ ...post, commentCount: Math.max(0, (post.commentCount || 1) - 1) });
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to delete comment.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center py-20 bg-slate-50 dark:bg-slate-950">
        <Spin size="large" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen py-20 text-center bg-slate-50 dark:bg-slate-950">
        <Title level={3} className="text-slate-700 dark:text-slate-300">
          Post not found or unavailable.
        </Title>
        <Button onClick={() => navigate("/blog")} icon={<ArrowLeftOutlined />} className="mt-4 rounded-xl">
          Back to Blogs
        </Button>
      </div>
    );
  }

  const isOwner = userId && post.created_by === userId;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Back Button & Actions Bar */}
        <div className="flex items-center justify-between">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/blog")}
            className="rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800"
          >
            Back to Articles
          </Button>

          {isOwner && (
            <div className="flex items-center gap-2">
              <Button
                icon={<EditOutlined />}
                onClick={() => setEditPostModalOpen(true)}
                className="rounded-xl font-semibold"
              >
                Edit
              </Button>
              <Popconfirm
                title="Delete Post"
                description="Are you sure you want to delete this post?"
                onConfirm={handleDeletePost}
                okText="Yes, Delete"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<DeleteOutlined />} className="rounded-xl font-semibold">
                  Delete
                </Button>
              </Popconfirm>
            </div>
          )}
        </div>

        {/* Main Article Container */}
        <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 dark:bg-slate-900 shadow-xl p-4 sm:p-8">
          <div className="space-y-6">
            {/* Header: Author badge & Tag */}
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <Avatar
                  size={48}
                  src={post.user?.profile_pic}
                  icon={!post.user?.profile_pic && <UserOutlined />}
                  className="bg-linear-to-br from-indigo-500 to-purple-600 shadow-md"
                />
                <div>
                  <Text className="block font-black text-slate-900 dark:text-white text-base">
                    {post.user?.username || "Anonymous"}
                  </Text>
                  <Text className="block text-xs text-slate-400">
                    Published on {new Date(post.created_at).toLocaleDateString()}
                  </Text>
                </div>
              </div>

              <Tag
                color={post.visibility === "PUBLIC" ? "blue" : "default"}
                className="rounded-full px-3 py-1 font-bold text-xs uppercase tracking-wider"
              >
                {post.visibility}
              </Tag>
            </div>

            {/* Article Title */}
            <Title level={2} className="m-0! font-black! text-slate-900! dark:text-white! leading-tight">
              {post.title}
            </Title>

            {/* Image Gallery */}
            {(post.images?.length > 0 || post.image) && (
              <div className="space-y-4">
                {(post.images || [post.image!]).map((imgUrl, idx) => (
                  <div key={idx} className="rounded-2xl overflow-hidden shadow-lg bg-slate-100 dark:bg-slate-800 max-h-[500px]">
                    <img src={imgUrl} alt={`Attachment ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}

            {/* Body Content */}
            <div className="whitespace-pre-wrap text-slate-700 dark:text-slate-200 text-base leading-relaxed font-sans py-4 border-t border-b border-slate-100 dark:border-slate-800">
              {post.content}
            </div>

            {/* Social Engagement Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button
                type={isLiked ? "primary" : "default"}
                icon={isLiked ? <LikeFilled /> : <LikeOutlined />}
                onClick={handleToggleLike}
                className={`h-11 px-6 rounded-xl font-bold ${
                  isLiked ? "bg-indigo-600" : "dark:border-slate-700"
                }`}
              >
                {post.likeCount} {post.likeCount === 1 ? "Like" : "Likes"}
              </Button>

              <Button
                icon={<FolderAddOutlined />}
                onClick={() => setPlaylistModalOpen(true)}
                className="h-11 px-6 rounded-xl font-bold border-indigo-400 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
              >
                Add to Playlist
              </Button>
            </div>
          </div>
        </Card>

        {/* Comments Section */}
        <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 dark:bg-slate-900 shadow-lg p-4 sm:p-6 space-y-6">
          <Title level={4} className="m-0! font-black! text-slate-900! dark:text-white! border-b border-slate-100 dark:border-slate-800 pb-3">
            Discussion & Comments ({comments.length})
          </Title>

          {/* New Comment Input */}
          <div className="space-y-3">
            <Input.TextArea
              rows={3}
              placeholder="Join the discussion or leave study notes feedback..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="rounded-2xl text-sm"
            />
            <div className="flex justify-end">
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={postingComment}
                onClick={handleAddComment}
                className="h-10 px-6 rounded-xl bg-indigo-600 font-bold hover:bg-indigo-500"
              >
                Post Comment
              </Button>
            </div>
          </div>

          <Divider className="my-4 border-slate-100! dark:border-slate-800!" />

          {/* Comments List */}
          <List
            dataSource={comments}
            locale={{ emptyText: "No comments yet. Be the first to start the discussion!" }}
            renderItem={(item) => {
              const isCommentOwner = userId && item.created_by === userId;
              const isEditing = editingCommentId === item.id;

              return (
                <div className="p-4 mb-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar
                        size="small"
                        src={item.user?.profile_pic}
                        icon={!item.user?.profile_pic && <UserOutlined />}
                        className="bg-indigo-500"
                      />
                      <Text className="font-bold text-slate-900 dark:text-white text-xs">
                        {item.user?.username || "Community User"}
                      </Text>
                      <Text className="text-[10px] text-slate-400">
                        • {new Date(item.created_at).toLocaleDateString()}
                      </Text>
                    </div>

                    {isCommentOwner && !isEditing && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => {
                            setEditingCommentId(item.id);
                            setEditingCommentText(item.content);
                          }}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        />
                        <Popconfirm
                          title="Delete Comment"
                          description="Delete this comment?"
                          onConfirm={() => handleDeleteComment(item.id)}
                          okText="Delete"
                          okButtonProps={{ danger: true }}
                        >
                          <Button
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            className="text-rose-400 hover:text-rose-600"
                          />
                        </Popconfirm>
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="mt-2 space-y-2">
                      <Input.TextArea
                        value={editingCommentText}
                        onChange={(e) => setEditingCommentText(e.target.value)}
                        rows={2}
                        className="rounded-xl"
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="small" onClick={() => setEditingCommentId(null)} className="rounded-lg">
                          Cancel
                        </Button>
                        <Button
                          size="small"
                          type="primary"
                          onClick={() => handleUpdateComment(item.id)}
                          className="rounded-lg bg-indigo-600 font-bold"
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Paragraph className="m-0! text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                      {item.content}
                    </Paragraph>
                  )}
                </div>
              );
            }}
          />
        </Card>
      </div>

      {/* Modals */}
      <AddToPlaylistModal
        open={playlistModalOpen}
        postId={post.id}
        onClose={() => setPlaylistModalOpen(false)}
      />

      <CreatePostModal
        open={editPostModalOpen}
        onClose={() => setEditPostModalOpen(false)}
        editingPost={post}
        onSuccess={(updated) => setPost(updated)}
      />
    </div>
  );
};

export default BlogPostDetail;
