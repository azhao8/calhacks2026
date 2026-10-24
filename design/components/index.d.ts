import type * as React from 'react';
export type SchoolTheme = 'berkeley' | 'base' | string;
export type IconName = 'check' | 'pin' | 'clock' | 'ticket' | 'music' | 'spark' | 'at' | 'phone' | 'copy' | 'alert' | 'offline' | 'calendar' | 'search' | 'arrow' | 'back';
export type BackdropObject = 'speaker' | 'headphones' | 'cassette' | 'ticket' | 'records' | 'mic' | 'radio' | 'none';
export interface BackdropProps { object?: BackdropObject; school?: SchoolTheme; quiet?: boolean; className?: string }
export declare function Backdrop(props: BackdropProps): React.ReactElement;
export interface MenuButtonProps { label?: string; expanded?: boolean; onClick?: () => void; className?: string }
export declare function MenuButton(props: MenuButtonProps): React.ReactElement;
export interface CanvasProps { school?: SchoolTheme; pattern?: string; patternSize?: string; image?: string; logo?: boolean; actions?: React.ReactNode; children?: React.ReactNode; className?: string; style?: React.CSSProperties }
export declare function Canvas(props: CanvasProps): React.ReactElement;
export interface WordmarkProps { size?: 's' | 'm' | 'l'; className?: string }
export declare function Wordmark(props: WordmarkProps): React.ReactElement;
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'secondary' | 'quiet'; icon?: IconName; iconAfter?: IconName; loading?: boolean; pressed?: boolean; block?: boolean }
export declare function Button(props: ButtonProps): React.ReactElement;
export interface SpotifyConnectButtonProps { state?: 'idle' | 'connecting' | 'connected'; logo?: React.ReactNode; label?: string; account?: string; note?: string; onClick?: () => void }
export declare function SpotifyConnectButton(props: SpotifyConnectButtonProps): React.ReactElement;
export interface School { id: string; name: string; city?: string; colors?: [string, string]; status?: 'open' | 'soon' }
export interface SchoolPickerProps { schools: School[]; value?: string; onChange?: (id: string) => void; query?: string; onSearch?: React.ChangeEventHandler<HTMLInputElement>; label?: string; inputId?: string }
export declare function SchoolPicker(props: SchoolPickerProps): React.ReactElement;
export interface QuestionOption { id: string; label: string; sub?: string }
export interface QuestionnaireStepProps { id?: string; step: number; total: number; title: string; hint?: string; options: QuestionOption[]; multi?: boolean; value?: string | string[]; onChange?: (id: string) => void; onNext?: () => void; onSurprise?: () => void; nextLabel?: string }
export declare function QuestionnaireStep(props: QuestionnaireStepProps): React.ReactElement;
export interface TasteSummaryProps { summary: string; artists?: string[]; eyebrow?: string; confirmed?: boolean; onConfirm?: () => void; onCorrect?: () => void }
export declare function TasteSummary(props: TasteSummaryProps): React.ReactElement;
export interface ConcertCardProps { day: string; time: string; price: string; distance?: string; going?: boolean; onToggle?: () => void; revealed?: boolean; artist?: string; venue?: string; kind?: string }
export declare function ConcertCard(props: ConcertCardProps): React.ReactElement;
export interface ArtistCardProps { name: string; genres?: string[]; local?: boolean; why?: string; next?: string; image?: string; spotifyUrl?: string; logo?: React.ReactNode }
export declare function ArtistCard(props: ArtistCardProps): React.ReactElement;
export interface MatchCardProps { stage?: 'invite' | 'confirmed' | 'dayof'; name: string; when: string; price: string; event?: string; shared?: string; meetSpot?: string; meetTime?: string; ticketUrl?: string; ticketDone?: boolean; number?: string; icebreaker?: string; onAccept?: () => void; onDecline?: () => void; onTicket?: () => void }
export declare function MatchCard(props: MatchCardProps): React.ReactElement;
export interface ChatBubbleProps { from?: 'me' | 'them' | 'system'; name?: string; time?: string; children?: React.ReactNode }
export declare function ChatBubble(props: ChatBubbleProps): React.ReactElement;
export interface ConnectorButtonProps { kind: 'instagram' | 'phone'; sent?: boolean; label?: string; onClick?: () => void }
export declare function ConnectorButton(props: ConnectorButtonProps): React.ReactElement;
export interface InfoCardProps { kind: 'instagram' | 'phone'; from: string; value: string }
export declare function InfoCard(props: InfoCardProps): React.ReactElement;
export interface StateViewProps { kind: 'loading' | 'empty' | 'error' | 'offline'; title?: string; body?: string; action?: string | null; onAction?: () => void; inline?: boolean; icon?: IconName }
export declare function StateView(props: StateViewProps): React.ReactElement;
export declare function Icon(props: { name: IconName; className?: string }): React.ReactElement;
declare global { interface Window { Melos: { Backdrop: typeof Backdrop; MenuButton: typeof MenuButton; Canvas: typeof Canvas; Wordmark: typeof Wordmark; Button: typeof Button; SpotifyConnectButton: typeof SpotifyConnectButton; SchoolPicker: typeof SchoolPicker; QuestionnaireStep: typeof QuestionnaireStep; TasteSummary: typeof TasteSummary; ConcertCard: typeof ConcertCard; ArtistCard: typeof ArtistCard; MatchCard: typeof MatchCard; ChatBubble: typeof ChatBubble; ConnectorButton: typeof ConnectorButton; InfoCard: typeof InfoCard; StateView: typeof StateView; Icon: typeof Icon } } }
