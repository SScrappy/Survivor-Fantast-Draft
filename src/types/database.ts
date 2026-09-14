export type LeagueStatus = "pending" | "live" | "complete";

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
};

export type League = {
  id: string;
  name: string;
  owner_id: string;
  season: string;
  num_drafters: number;
  num_rounds: number;
  status: LeagueStatus;
  invite_code: string;
  created_at: string;
};

export type LeagueMember = {
  id: string;
  league_id: string;
  profile_id: string;
  draft_position: number | null;
  joined_at: string;
};

export type Player = {
  id: string;
  name: string;
  season: string;
  tribe: string | null;
  photo_url: string | null;
  bio: string | null;
  placement: number | null;
  created_at: string;
};

export type Pick = {
  id: string;
  league_id: string;
  round: number;
  pick_number: number;
  profile_id: string;
  player_id: string;
  created_at: string;
};

export type HallOfFameEntry = {
  id: string;
  season: string;
  winner_profile_id: string;
  created_at: string;
};

export type RosterRow = {
  league_id: string;
  profile_id: string;
  display_name: string;
  round: number;
  pick_number: number;
  player_id: string;
  player_name: string;
  tribe: string | null;
  photo_url: string | null;
  placement: number | null;
  points: number;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; display_name: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      leagues: {
        Row: League;
        Insert: Partial<League> & {
          name: string;
          owner_id: string;
          num_drafters: number;
          num_rounds: number;
        };
        Update: Partial<League>;
        Relationships: [];
      };
      league_members: {
        Row: LeagueMember;
        Insert: Partial<LeagueMember> & { league_id: string; profile_id: string };
        Update: Partial<LeagueMember>;
        Relationships: [];
      };
      players: {
        Row: Player;
        Insert: Partial<Player> & { name: string; season: string };
        Update: Partial<Player>;
        Relationships: [];
      };
      picks: {
        Row: Pick;
        Insert: { league_id: string; player_id: string };
        Update: Partial<Pick>;
        Relationships: [];
      };
      hall_of_fame: {
        Row: HallOfFameEntry;
        Insert: { season: string; winner_profile_id: string };
        Update: Partial<HallOfFameEntry>;
        Relationships: [];
      };
    };
    Views: {
      rosters: {
        Row: RosterRow;
        Relationships: [];
      };
    };
    Functions: {
      find_league_by_code: {
        Args: { p_code: string };
        Returns: {
          id: string;
          name: string;
          season: string;
          status: LeagueStatus;
          num_drafters: number;
          num_rounds: number;
          member_count: number;
        }[];
      };
      set_draft_order: {
        Args: {
          p_league_id: string;
          p_assignments: { member_id: string; position: number }[];
        };
        Returns: undefined;
      };
      set_player_placement: {
        Args: { p_player_id: string; p_placement: number | null };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
