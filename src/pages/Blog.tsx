import React, { useEffect, useState } from "react";
import {
  Typography,
  Input,
  Button,
  Tabs,
  Card,
  Tag,
  Avatar,
  Empty,
  Spin,
  message,
  Dropdown,
} from "antd";
import {
  SearchOutlined,
  PlusOutlined,
  LikeOutlined,
  LikeFilled,
  CommentOutlined,
  FolderAddOutlined,
  UserOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  BookOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import {
  getAllPosts,
  getMyPosts,
  getLikedPosts,
  toggleLikePost,
  deletePost,
} from "../services/blogApi";
import type { BlogPost } from "../types/blog";
import CreatePostModal from "../components/CreatePostModal";
import AddToPlaylistModal from "../components/AddToPlaylistModal";
import Playlists from "./Playlists";
import { useAuth } from "../context/AuthContext";

const { Title, Text, Paragraph } = Typography;

const Blog: React.FC = () => {
  const navigate = useNavigate();
  const { userId } = useAuth();

  const [activeTab, setActiveTab] = useState<string>("explore");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [selectedPostIdForPlaylist, setSelectedPostIdForPlaylist] = useState<string | null>(null);

  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

  const fetchPostsData = async () => {
    setLoading(true);
    try {
      // Fetch liked post IDs if user is logged in
      try {
        const liked = await getLikedPosts();
        setLikedPostIds(new Set(liked));
      } catch {
        // Ignore unauth error for liked posts
      }

      if (activeTab === "explore") {
        const data = await getAllPosts();
        setPosts(data);
      } else if (activeTab === "myposts") {
        const data = await getMyPosts();
        setPosts(data);
      } else if (activeTab === "liked") {
        const all = await getAllPosts();
        const likedList = await getLikedPosts();
        const likedSet = new Set(likedList);
        setLikedPostIds(likedSet);
        setPosts(all.filter((p) => likedSet.has(p.id)));
      }
    } catch (err: any) {
      console.error("Error fetching posts:", err);
      message.error(err.response?.data?.message || "Failed to load posts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "playlists") {
      fetchPostsData();
    }
  }, [activeTab]);

  const handleToggleLike = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    try {
      await toggleLikePost(postId);
      setLikedPostIds((prev) => {
        const next = new Set(prev);
        if (next.has(postId)) {
          next.delete(postId);
        } else {
          next.add(postId);
        }
        return next;
      });

      setPosts((prevPosts) =>
        prevPosts.map((p) => {
          if (p.id === postId) {
            const wasLiked = likedPostIds.has(postId);
            return {
              ...p,
              likeCount: wasLiked ? Math.max(0, p.likeCount - 1) : p.likeCount + 1,
            };
          }
          return p;
        })
      );
    } catch (err: any) {
      message.error(err.response?.data?.message || "Please login to like posts.");
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deletePost(postId);
      message.success("Post deleted successfully.");
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to delete post.");
    }
  };

  const handleOpenEditModal = (e: React.MouseEvent, post: BlogPost) => {
    e.stopPropagation();
    setEditingPost(post);
    setCreateModalOpen(true);
  };

  const handleOpenPlaylistModal = (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    setSelectedPostIdForPlaylist(postId);
    setPlaylistModalOpen(true);
  };

  const filteredPosts = posts.filter((post) => {
    const q = searchQuery.toLowerCase();
    return (
      post.title.toLowerCase().includes(q) ||
      post.content.toLowerCase().includes(q) ||
      post.user?.username?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Banner Section */}
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-indigo-900 via-indigo-800 to-purple-900 p-8 sm:p-12 text-white shadow-2xl">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-80 h-80 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-indigo-200 text-xs font-bold uppercase tracking-widest border border-white/10">
                <ThunderboltOutlined /> Knowledge Sharing Hub
              </div>
              <Title level={1} className="text-3xl! sm:text-4xl! font-black! text-white! tracking-tight">
                Interview Prep Blogs & Study Notes
              </Title>
              <Text className="text-slate-300! text-sm sm:text-base font-medium block">
                Discover study guides, real interview experiences, and system design cheat-sheets, or write your own notes with built-in AI assistance.
              </Text>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingPost(null);
                  setCreateModalOpen(true);
                }}
                className="h-12 px-8 rounded-xl bg-linear-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 border-none font-bold text-base shadow-lg shadow-indigo-500/30"
              >
                Create Blog / Note
              </Button>
            </div>
          </div>
        </div>

        {/* Tab & Search Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            className="w-full md:w-auto font-bold"
            items={[
              {
                key: "explore",
                label: (
                  <span className="flex items-center gap-2">
                    <BookOutlined /> Explore Articles
                  </span>
                ),
              },
              {
                key: "myposts",
                label: (
                  <span className="flex items-center gap-2">
                    <UserOutlined /> My Notes / Posts
                  </span>
                ),
              },
              {
                key: "liked",
                label: (
                  <span className="flex items-center gap-2">
                    <LikeFilled /> Liked Articles
                  </span>
                ),
              },
              {
                key: "playlists",
                label: (
                  <span className="flex items-center gap-2">
                    <FolderAddOutlined /> My Playlists
                  </span>
                ),
              },
            ]}
          />

          {activeTab !== "playlists" && (
            <div className="w-full md:w-72">
              <Input
                placeholder="Search notes & blogs..."
                prefix={<SearchOutlined className="text-slate-400 mr-1" />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                allowClear
                className="rounded-xl h-10 text-sm"
              />
            </div>
          )}
        </div>

        {/* Tab Contents */}
        {activeTab === "playlists" ? (
          <Playlists />
        ) : loading ? (
          <div className="py-20 text-center">
            <Spin size="large" />
            <Text className="block mt-4 text-slate-500 font-medium">Fetching posts...</Text>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <Empty
              description={
                <Text className="text-slate-500 dark:text-slate-400 font-medium">
                  No articles or study notes found in this view.
                </Text>
              }
            >
              <Button
                type="primary"
                onClick={() => setCreateModalOpen(true)}
                icon={<PlusOutlined />}
                className="rounded-xl bg-indigo-600 font-bold"
              >
                Create First Post
              </Button>
            </Empty>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => {
              const isLiked = likedPostIds.has(post.id);
              const isOwner = userId && post.created_by === userId;

              return (
                <Card
                  key={post.id}
                  hoverable
                  onClick={() => navigate(`/blog/${post.id}`)}
                  className="rounded-3xl border-slate-200/80 dark:border-slate-800 dark:bg-slate-900 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group"
                >
                  <div className="space-y-4">
                    {/* Header Author & Visibility */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={post.user?.profile_pic}
                          icon={!post.user?.profile_pic && <UserOutlined />}
                          className="bg-linear-to-br from-indigo-500 to-purple-600"
                        />
                        <div>
                          <Text className="block font-bold text-slate-900 dark:text-white text-xs">
                            {post.user?.username || "Anonymous"}
                          </Text>
                          <Text className="block text-[10px] text-slate-400">
                            {new Date(post.created_at).toLocaleDateString()}
                          </Text>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Tag
                          color={post.visibility === "PUBLIC" ? "blue" : "default"}
                          className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border-none"
                        >
                          {post.visibility}
                        </Tag>

                        {isOwner && (
                          <Dropdown
                            menu={{
                              items: [
                                {
                                  key: "edit",
                                  label: "Edit Post",
                                  icon: <EditOutlined />,
                                  onClick: (info) => {
                                    info.domEvent.stopPropagation();
                                    handleOpenEditModal(info.domEvent as any, post);
                                  },
                                },
                                {
                                  key: "delete",
                                  label: "Delete Post",
                                  icon: <DeleteOutlined />,
                                  danger: true,
                                  onClick: (info) => {
                                    info.domEvent.stopPropagation();
                                    handleDeletePost(post.id);
                                  },
                                },
                              ],
                            }}
                            trigger={["click"]}
                          >
                            <Button
                              type="text"
                              icon={<MoreOutlined />}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            />
                          </Dropdown>
                        )}
                      </div>
                    </div>

                    {/* Image Preview if available */}
                    {(post.images?.length > 0 || post.image) && (
                      <div className="h-44 w-full overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
                        <img
                          src={post.images?.[0] || post.image}
                          alt={post.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    )}

                    {/* Title & Preview */}
                    <div>
                      <Title
                        level={4}
                        className="m-0! font-black! text-slate-900! dark:text-white! line-clamp-2 text-lg group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
                      >
                        {post.title}
                      </Title>
                      <Paragraph className="text-slate-500 dark:text-slate-400 text-xs mt-2 line-clamp-3 leading-relaxed">
                        {post.content}
                      </Paragraph>
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                      <Button
                        type="text"
                        size="small"
                        icon={isLiked ? <LikeFilled className="text-indigo-600 dark:text-indigo-400" /> : <LikeOutlined />}
                        onClick={(e) => handleToggleLike(e, post.id)}
                        className={`rounded-xl text-xs font-bold ${
                          isLiked ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500"
                        }`}
                      >
                        {post.likeCount || 0}
                      </Button>

                      <Button
                        type="text"
                        size="small"
                        icon={<CommentOutlined />}
                        className="rounded-xl text-slate-500 text-xs font-bold"
                      >
                        {post.commentCount || post.comments?.length || 0}
                      </Button>
                    </div>

                    <Button
                      type="text"
                      size="small"
                      icon={<FolderAddOutlined />}
                      onClick={(e) => handleOpenPlaylistModal(e, post.id)}
                      className="rounded-xl text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                    >
                      Save
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreatePostModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => fetchPostsData()}
        editingPost={editingPost}
      />

      <AddToPlaylistModal
        open={playlistModalOpen}
        postId={selectedPostIdForPlaylist}
        onClose={() => setPlaylistModalOpen(false)}
      />
    </div>
  );
};

export default Blog;
