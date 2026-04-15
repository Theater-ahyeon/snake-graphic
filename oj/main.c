#include <stdio.h>
#include <string.h>

#define BOARD_SIZE 20
#define MAX_CELLS 400
#define INF 1000000000

typedef struct {
    int r;
    int c;
} Pos;

typedef struct {
    Pos snake[MAX_CELLS];
    int len;
    int food_exists;
    Pos food;
    char dir;
    int score;
    int moves;
} State;

static char terrain[BOARD_SIZE][BOARD_SIZE + 1];
static int grow_every = 1;

static int same_pos(Pos a, Pos b) {
    return a.r == b.r && a.c == b.c;
}

static int in_board(Pos p) {
    return p.r >= 0 && p.r < BOARD_SIZE && p.c >= 0 && p.c < BOARD_SIZE;
}

static Pos step_to(Pos p, char dir) {
    Pos next = p;
    if (dir == 'W') next.r--;
    else if (dir == 'S') next.r++;
    else if (dir == 'A') next.c--;
    else next.c++;
    return next;
}

static char opposite_dir(char dir) {
    if (dir == 'W') return 'S';
    if (dir == 'S') return 'W';
    if (dir == 'A') return 'D';
    return 'A';
}

static char dir_from_to(Pos from, Pos to) {
    if (to.r == from.r - 1 && to.c == from.c) return 'W';
    if (to.r == from.r + 1 && to.c == from.c) return 'S';
    if (to.r == from.r && to.c == from.c - 1) return 'A';
    return 'D';
}

static void fill_candidate_dirs(char current_dir, char dirs[4]) {
    if (current_dir == 'W') {
        dirs[0] = 'W'; dirs[1] = 'A'; dirs[2] = 'D'; dirs[3] = 'S';
    } else if (current_dir == 'S') {
        dirs[0] = 'S'; dirs[1] = 'D'; dirs[2] = 'A'; dirs[3] = 'W';
    } else if (current_dir == 'A') {
        dirs[0] = 'A'; dirs[1] = 'S'; dirs[2] = 'W'; dirs[3] = 'D';
    } else {
        dirs[0] = 'D'; dirs[1] = 'W'; dirs[2] = 'S'; dirs[3] = 'A';
    }
}

static void build_blocked(const State *st, int free_tail, int blocked[BOARD_SIZE][BOARD_SIZE]) {
    int r, c, i;
    for (r = 0; r < BOARD_SIZE; ++r) {
        for (c = 0; c < BOARD_SIZE; ++c) {
            blocked[r][c] = (terrain[r][c] == '#' || terrain[r][c] == 'O');
        }
    }

    for (i = 1; i < st->len; ++i) {
        if (free_tail && i == st->len - 1) continue;
        blocked[st->snake[i].r][st->snake[i].c] = 1;
    }
}

static int shortest_path(const State *st, Pos start, Pos goal, int free_tail, Pos out_path[MAX_CELLS]) {
    int blocked[BOARD_SIZE][BOARD_SIZE];
    int dist[BOARD_SIZE][BOARD_SIZE];
    Pos parent[BOARD_SIZE][BOARD_SIZE];
    Pos queue[MAX_CELLS];
    Pos reverse_path[MAX_CELLS];
    int head = 0, tail = 0;
    int r, c;
    static const int dr[4] = {-1, 1, 0, 0};
    static const int dc[4] = {0, 0, -1, 1};

    if (same_pos(start, goal)) return 0;

    build_blocked(st, free_tail, blocked);
    blocked[start.r][start.c] = 0;
    blocked[goal.r][goal.c] = 0;

    for (r = 0; r < BOARD_SIZE; ++r) {
        for (c = 0; c < BOARD_SIZE; ++c) {
            dist[r][c] = -1;
            parent[r][c].r = -1;
            parent[r][c].c = -1;
        }
    }

    queue[tail++] = start;
    dist[start.r][start.c] = 0;

    while (head < tail) {
        Pos cur = queue[head++];
        int k;
        if (same_pos(cur, goal)) break;
        for (k = 0; k < 4; ++k) {
            Pos nxt;
            nxt.r = cur.r + dr[k];
            nxt.c = cur.c + dc[k];
            if (!in_board(nxt)) continue;
            if (blocked[nxt.r][nxt.c]) continue;
            if (dist[nxt.r][nxt.c] != -1) continue;
            dist[nxt.r][nxt.c] = dist[cur.r][cur.c] + 1;
            parent[nxt.r][nxt.c] = cur;
            queue[tail++] = nxt;
        }
    }

    if (dist[goal.r][goal.c] == -1) return -1;

    {
        int len = 0;
        Pos cur = goal;
        while (!same_pos(cur, start)) {
            reverse_path[len++] = cur;
            cur = parent[cur.r][cur.c];
        }
        while (len > 0) {
            out_path[dist[goal.r][goal.c] - len] = reverse_path[len - 1];
            len--;
        }
    }

    return dist[goal.r][goal.c];
}

static int can_reach_tail(const State *st) {
    Pos path[MAX_CELLS];
    if (st->len <= 1) return 1;
    return shortest_path(st, st->snake[0], st->snake[st->len - 1], 1, path) >= 0;
}

static int reachable_area(const State *st) {
    int blocked[BOARD_SIZE][BOARD_SIZE];
    int vis[BOARD_SIZE][BOARD_SIZE];
    Pos queue[MAX_CELLS];
    int head = 0, tail = 0;
    int count = 0;
    static const int dr[4] = {-1, 1, 0, 0};
    static const int dc[4] = {0, 0, -1, 1};

    build_blocked(st, 1, blocked);
    memset(vis, 0, sizeof(vis));
    blocked[st->snake[0].r][st->snake[0].c] = 0;

    queue[tail++] = st->snake[0];
    vis[st->snake[0].r][st->snake[0].c] = 1;

    while (head < tail) {
        Pos cur = queue[head++];
        int k;
        count++;
        for (k = 0; k < 4; ++k) {
            Pos nxt;
            nxt.r = cur.r + dr[k];
            nxt.c = cur.c + dc[k];
            if (!in_board(nxt)) continue;
            if (blocked[nxt.r][nxt.c] || vis[nxt.r][nxt.c]) continue;
            vis[nxt.r][nxt.c] = 1;
            queue[tail++] = nxt;
        }
    }

    return count;
}

static int advance_state(State *st, char cmd) {
    int i;
    Pos next_head;
    int eat, periodic_growth, grow;

    if (st->len > 1 && cmd == opposite_dir(st->dir)) return 0;

    next_head = step_to(st->snake[0], cmd);
    if (!in_board(next_head)) return 0;
    if (terrain[next_head.r][next_head.c] == '#' || terrain[next_head.r][next_head.c] == 'O') return 0;

    eat = st->food_exists && same_pos(next_head, st->food);
    periodic_growth = ((st->moves + 1) % grow_every == 0);
    grow = eat || periodic_growth;

    for (i = 0; i < st->len; ++i) {
        if (!same_pos(st->snake[i], next_head)) continue;
        if (!(i == st->len - 1 && !grow)) return 0;
    }

    for (i = st->len; i > 0; --i) {
        st->snake[i] = st->snake[i - 1];
    }
    st->snake[0] = next_head;

    if (eat) {
        st->food_exists = 0;
        st->score += 10;
    }
    if (grow) {
        st->len++;
    }

    st->dir = cmd;
    st->moves++;
    return 1;
}

static int food_distance(const State *st) {
    Pos path[MAX_CELLS];
    if (!st->food_exists) return INF;
    {
        int dist = shortest_path(st, st->snake[0], st->food, 1, path);
        return dist >= 0 ? dist : INF;
    }
}

static int safe_food_distance(const State *st) {
    Pos path[MAX_CELLS];
    State sim;
    int dist, i;
    Pos cur;

    if (!st->food_exists) return INF;
    dist = shortest_path(st, st->snake[0], st->food, 1, path);
    if (dist < 0) return INF;

    sim = *st;
    cur = sim.snake[0];
    for (i = 0; i < dist; ++i) {
        char cmd = dir_from_to(cur, path[i]);
        if (!advance_state(&sim, cmd)) return INF;
        cur = path[i];
    }

    return can_reach_tail(&sim) ? dist : INF;
}

static char choose_safe_food_move(const State *st) {
    Pos path[MAX_CELLS];
    State sim;
    int dist, i;
    Pos cur;

    if (!st->food_exists) return 0;

    dist = shortest_path(st, st->snake[0], st->food, 1, path);
    if (dist <= 0) return 0;
    if (dist == 1) {
        State immediate = *st;
        char cmd = dir_from_to(st->snake[0], path[0]);
        if (advance_state(&immediate, cmd)) return cmd;
        return 0;
    }

    sim = *st;
    cur = sim.snake[0];
    for (i = 0; i < dist; ++i) {
        char cmd = dir_from_to(cur, path[i]);
        if (!advance_state(&sim, cmd)) return 0;
        cur = path[i];
    }

    if (can_reach_tail(&sim)) {
        return dir_from_to(st->snake[0], path[0]);
    }
    return 0;
}

static int better_candidate(
    int tier_a, int safe_food_a, int area_a, int plain_food_a, int tail_dist_a, int prefer_current_a, char cmd_a,
    int tier_b, int safe_food_b, int area_b, int plain_food_b, int tail_dist_b, int prefer_current_b, char cmd_b
) {
    if (tier_a != tier_b) return tier_a > tier_b;
    if (tier_a == 3 && safe_food_a != safe_food_b) return safe_food_a < safe_food_b;
    if (area_a != area_b) return area_a > area_b;
    if (plain_food_a != plain_food_b) return plain_food_a < plain_food_b;
    if (tail_dist_a != tail_dist_b) return tail_dist_a < tail_dist_b;
    if (prefer_current_a != prefer_current_b) return prefer_current_a > prefer_current_b;
    return cmd_a < cmd_b;
}

static char choose_move(const State *st) {
    char dirs[4];
    char safe_food_move;
    int found = 0;
    char best_cmd = 'W';
    int best_tier = -1;
    int best_safe_food = INF;
    int best_area = -1;
    int best_plain_food = INF;
    int best_tail_dist = INF;
    int best_prefer_current = 0;
    int i;

    fill_candidate_dirs(st->dir, dirs);

    safe_food_move = choose_safe_food_move(st);
    if (safe_food_move != 0) return safe_food_move;

    for (i = 0; i < 4; ++i) {
        State nxt = *st;
        Pos path[MAX_CELLS];
        int tier, safe_food, area, plain_food, tail_dist, prefer_current;
        char cmd = dirs[i];

        if (!advance_state(&nxt, cmd)) continue;

        safe_food = safe_food_distance(&nxt);
        area = reachable_area(&nxt);
        plain_food = food_distance(&nxt);
        tail_dist = shortest_path(&nxt, nxt.snake[0], nxt.snake[nxt.len - 1], 1, path);
        if (tail_dist < 0) tail_dist = INF;
        prefer_current = (cmd == st->dir);

        if (safe_food != INF) tier = 3;
        else if (can_reach_tail(&nxt)) tier = 2;
        else tier = 1;

        if (!found || better_candidate(
                tier, safe_food, area, plain_food, tail_dist, prefer_current, cmd,
                best_tier, best_safe_food, best_area, best_plain_food, best_tail_dist, best_prefer_current, best_cmd)) {
            found = 1;
            best_cmd = cmd;
            best_tier = tier;
            best_safe_food = safe_food;
            best_area = area;
            best_plain_food = plain_food;
            best_tail_dist = tail_dist;
            best_prefer_current = prefer_current;
        }
    }

    if (found) return best_cmd;
    if (st->dir != 'S') return 'W';
    return 'A';
}

static void build_snake_from_map(char raw_map[BOARD_SIZE][BOARD_SIZE + 1], State *st) {
    int body[BOARD_SIZE][BOARD_SIZE];
    int r, c;
    Pos head = {-1, -1};
    Pos prev, cur, next_seg;

    memset(body, 0, sizeof(body));
    st->len = 0;

    for (r = 0; r < BOARD_SIZE; ++r) {
        for (c = 0; c < BOARD_SIZE; ++c) {
            if (raw_map[r][c] == 'H') {
                head.r = r;
                head.c = c;
            } else if (raw_map[r][c] == 'B') {
                body[r][c] = 1;
            }
        }
    }

    st->snake[st->len++] = head;
    prev = head;
    cur.r = -1;
    cur.c = -1;

    if (head.r > 0 && body[head.r - 1][head.c]) {
        cur.r = head.r - 1; cur.c = head.c;
    } else if (head.r + 1 < BOARD_SIZE && body[head.r + 1][head.c]) {
        cur.r = head.r + 1; cur.c = head.c;
    } else if (head.c > 0 && body[head.r][head.c - 1]) {
        cur.r = head.r; cur.c = head.c - 1;
    } else if (head.c + 1 < BOARD_SIZE && body[head.r][head.c + 1]) {
        cur.r = head.r; cur.c = head.c + 1;
    }

    while (cur.r != -1) {
        body[cur.r][cur.c] = 0;
        st->snake[st->len++] = cur;

        next_seg.r = -1;
        next_seg.c = -1;
        if (cur.r > 0 && body[cur.r - 1][cur.c] && !(prev.r == cur.r - 1 && prev.c == cur.c)) {
            next_seg.r = cur.r - 1; next_seg.c = cur.c;
        } else if (cur.r + 1 < BOARD_SIZE && body[cur.r + 1][cur.c] && !(prev.r == cur.r + 1 && prev.c == cur.c)) {
            next_seg.r = cur.r + 1; next_seg.c = cur.c;
        } else if (cur.c > 0 && body[cur.r][cur.c - 1] && !(prev.r == cur.r && prev.c == cur.c - 1)) {
            next_seg.r = cur.r; next_seg.c = cur.c - 1;
        } else if (cur.c + 1 < BOARD_SIZE && body[cur.r][cur.c + 1] && !(prev.r == cur.r && prev.c == cur.c + 1)) {
            next_seg.r = cur.r; next_seg.c = cur.c + 1;
        }

        prev = cur;
        cur = next_seg;
    }
}

static void render_map(const State *st, char out[BOARD_SIZE][BOARD_SIZE + 1]) {
    int r, i;
    for (r = 0; r < BOARD_SIZE; ++r) {
        strcpy(out[r], terrain[r]);
    }
    if (st->food_exists) {
        out[st->food.r][st->food.c] = 'F';
    }
    for (i = 0; i < st->len; ++i) {
        out[st->snake[i].r][st->snake[i].c] = (i == 0 ? 'H' : 'B');
    }
}

int main(void) {
    char raw_map[BOARD_SIZE][BOARD_SIZE + 1];
    State state;
    int r, c;

    for (r = 0; r < BOARD_SIZE; ++r) {
        if (scanf("%20s", raw_map[r]) != 1) return 0;
    }
    if (scanf("%d", &grow_every) != 1) return 0;

    memset(&state, 0, sizeof(state));
    state.dir = 'W';
    build_snake_from_map(raw_map, &state);

    for (r = 0; r < BOARD_SIZE; ++r) {
        for (c = 0; c < BOARD_SIZE; ++c) {
            if (raw_map[r][c] == 'F') {
                state.food_exists = 1;
                state.food.r = r;
                state.food.c = c;
                terrain[r][c] = '.';
            } else if (raw_map[r][c] == 'H' || raw_map[r][c] == 'B') {
                terrain[r][c] = '.';
            } else {
                terrain[r][c] = raw_map[r][c];
            }
        }
        terrain[r][BOARD_SIZE] = '\0';
    }

    while (1) {
        int x, y;
        char cmd = choose_move(&state);
        char final_map[BOARD_SIZE][BOARD_SIZE + 1];

        printf("%c\n%d\n", cmd, state.score);
        fflush(stdout);

        if (scanf("%d%d", &x, &y) != 2) return 0;

        if (x == 100 && y == 100) {
            render_map(&state, final_map);
            for (r = 0; r < BOARD_SIZE; ++r) {
                printf("%s\n", final_map[r]);
            }
            printf("%d\n", state.score);
            fflush(stdout);
            return 0;
        }

        if (!advance_state(&state, cmd)) {
            render_map(&state, final_map);
            for (r = 0; r < BOARD_SIZE; ++r) {
                printf("%s\n", final_map[r]);
            }
            printf("%d\n", state.score);
            fflush(stdout);
            return 0;
        }

        if (x > 0 && x < 19 && y > 0 && y < 19) {
            state.food_exists = 1;
            state.food.r = x;
            state.food.c = y;
        }
    }
}
