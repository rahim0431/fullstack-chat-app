import { useState } from "react";
import { MessageSquare, MessageCircle, Heart, Smile, Star, Zap, Search, UserPlus, Lock, Menu } from "lucide-react";
import SearchUsersModal from "./SearchUsersModal";

const NoChatSelected = ({ onOpenSidebar }) => {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [modalTab, setModalTab] = useState("discover");
	return (
		<>
			<div className='w-full flex flex-1 flex-col items-center justify-center relative overflow-hidden'>
				{onOpenSidebar && (
					<button
						type="button"
						onClick={onOpenSidebar}
						className="btn btn-ghost btn-sm btn-circle md:hidden absolute left-3 top-3 z-20"
						aria-label="Open sidebar"
					>
						<Menu className="size-5" />
					</button>
				)}
				{/* === WALLPAPER LAYER === */}
				{/* Tiled SVG wallpaper image (matches ChatContainer) */}
				<div
					className='absolute inset-0 pointer-events-none'
					style={{
						backgroundImage: "url('/chat-bg.svg')",
						backgroundSize: "160px 160px",
						backgroundRepeat: "repeat",
					}}
				/>
				{/* Color tint overlay */}
				<div className='absolute inset-0 bg-base-200/85 pointer-events-none' />

				{/* Floating background icons */}
				<div className='absolute inset-0 pointer-events-none overflow-hidden select-none'>
					{[
						{ Icon: MessageCircle, top: "8%", left: "6%", size: 28, delay: "0s", opacity: 0.08 },
						{ Icon: Heart, top: "15%", right: "8%", size: 22, delay: "0.8s", opacity: 0.07 },
						{ Icon: Star, top: "35%", left: "4%", size: 18, delay: "1.5s", opacity: 0.08 },
						{ Icon: Smile, top: "55%", right: "5%", size: 26, delay: "0.4s", opacity: 0.07 },
						{ Icon: Zap, top: "72%", left: "7%", size: 20, delay: "1.2s", opacity: 0.07 },
						{ Icon: MessageCircle, top: "80%", right: "9%", size: 30, delay: "0.9s", opacity: 0.07 },
						{ Icon: Star, top: "20%", left: "50%", size: 16, delay: "0.3s", opacity: 0.06 },
						{ Icon: Heart, top: "65%", left: "45%", size: 20, delay: "1.8s", opacity: 0.06 },
					].map(({ Icon, top, left, right, size, delay, opacity }, i) => (
						<div
							key={i}
							className='absolute animate-pulse'
							style={{ top, left, right, animationDelay: delay, animationDuration: "3s", opacity }}
						>
							<Icon style={{ width: size, height: size }} />
						</div>
					))}
				</div>

				{/* === CONTENT CARD === */}
				<div className='relative z-10 max-w-sm text-center space-y-6 px-6'>
					{/* Animated icon */}
					<div className='flex justify-center'>
						<div className='relative'>
							<div className='w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-2xl animate-bounce'>
								<MessageSquare className='w-12 h-12 text-white' />
							</div>
							{/* <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-green-500 border-4 border-base-100 shadow-sm" /> */}
						</div>
					</div>

					{/* Text */}
					<div>
						<h2 className='text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-3'>
							Welcome to Chatty!
						</h2>
						<p className='text-base-content/60 text-base leading-relaxed'>
							Choose a conversation from the sidebar to start chatting with your connections.
						</p>
					</div>

					{/* CTAs */}
					<div className='flex justify-center gap-4'>
						<button
							className='btn btn-primary rounded-full gap-2 px-6 shadow-lg shadow-primary/25'
							onClick={() => {
								setModalTab("connections");
								setIsModalOpen(true);
							}}
						>
							<UserPlus className='w-4 h-4' />
							Start New Chat
						</button>
						<button
							className='btn btn-outline rounded-full gap-2 px-6 border-primary/40 text-primary hover:border-primary hover:bg-primary/10'
							onClick={() => {
								setModalTab("discover");
								setIsModalOpen(true);
							}}
						>
							<Search className='w-4 h-4' />
							Find People
						</button>
					</div>

					{/* Decorative pills */}
					<div className='flex flex-wrap justify-center gap-2'>
						{[
							{ label: "Instant Messages", Icon: MessageCircle },
							{ label: "Real-time Alerts", Icon: Zap },
							{ label: "Secure Chat", Icon: Lock },
						].map(({ label, Icon }) => (
							<span
								key={label}
								className='px-3 py-1.5 bg-base-100/60 backdrop-blur-sm border border-base-300/60 text-xs font-medium rounded-full text-base-content/70 shadow-sm inline-flex items-center gap-1.5'
							>
								<Icon className='w-3.5 h-3.5 text-primary/70' />
								{label}
							</span>
						))}
					</div>
				</div>
			</div>

			<SearchUsersModal
				isOpen={isModalOpen}
				initialTab={modalTab}
				onClose={() => setIsModalOpen(false)}
			/>
		</>
	);
};

export default NoChatSelected;

