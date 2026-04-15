#include <bits/stdc++.h>
using namespace std;

namespace {

constexpr int BOARD_SIZE = 20;
constexpr int INF = 1e9;

struct Pos {
    int r = 0;
    int c = 0;

    bool operator==(const Pos& other) const {
        return r == other.r && c == other.c;
    }
};

struct State {
    deque<Pos> snake;
    optional<Pos> food;
    char dir = 'W';
    int score = 0;
    int moves = 0;
};

array<string, BOARD_SIZE> terrain;
int grow_every = 1;

bool in_board(const Pos& p) {
    return p.r >= 0 && p.r < BOARD_SIZE && p.c >= 0 && p.c < BOARD_SIZE;
}

Pos step_to(const Pos& p, char dir) {
    if (dir == 'W') return {p.r - 1, p.c};
    if (dir == 'S') return {p.r + 1, p.c};
    if (dir == 'A') return {p.r, p.c - 1};
    return {p.r, p.c + 1};
}

char opposite_dir(char dir) {
    if (dir == 'W') return 'S';
    if (dir == 'S') return 'W';
    if (dir == 'A') return 'D';
    return 'A';
}

vector<Pos> neighbors4(const Pos& p) {
    return {
        {p.r - 1, p.c},
        {p.r + 1, p.c},
        {p.r, p.c - 1},
        {p.r, p.c + 1},
    };
}

char dir_from_to(const Pos& from, const Pos& to) {
    if (to.r == from.r - 1 && to.c == from.c) return 'W';
    if (to.r == from.r + 1 && to.c == from.c) return 'S';
    if (to.r == from.r && to.c == from.c - 1) return 'A';
    return 'D';
}

vector<vector<bool>> build_blocked(const State& st, bool free_tail) {
    vector<vector<bool>> blocked(BOARD_SIZE, vector<bool>(BOARD_SIZE, false));
    for (int r = 0; r < BOARD_SIZE; ++r) {
        for (int c = 0; c < BOARD_SIZE; ++c) {
            blocked[r][c] = (terrain[r][c] == '#' || terrain[r][c] == 'O');
        }
    }

    for (size_t i = 1; i < st.snake.size(); ++i) {
        if (free_tail && i + 1 == st.snake.size()) continue;
        blocked[st.snake[i].r][st.snake[i].c] = true;
    }
    return blocked;
}

vector<Pos> shortest_path(const State& st, const Pos& start, const Pos& goal, bool free_tail) {
    vector<vector<bool>> blocked = build_blocked(st, free_tail);
    blocked[start.r][start.c] = false;
    blocked[goal.r][goal.c] = false;

    queue<Pos> q;
    vector<vector<int>> dist(BOARD_SIZE, vector<int>(BOARD_SIZE, -1));
    vector<vector<Pos>> parent(BOARD_SIZE, vector<Pos>(BOARD_SIZE, {-1, -1}));
    q.push(start);
    dist[start.r][start.c] = 0;

    while (!q.empty()) {
        Pos cur = q.front();
        q.pop();
        if (cur == goal) break;
        for (const Pos& nxt : neighbors4(cur)) {
            if (!in_board(nxt) || blocked[nxt.r][nxt.c] || dist[nxt.r][nxt.c] != -1) continue;
            dist[nxt.r][nxt.c] = dist[cur.r][cur.c] + 1;
            parent[nxt.r][nxt.c] = cur;
            q.push(nxt);
        }
    }

    if (dist[goal.r][goal.c] == -1) return {};

    vector<Pos> path;
    Pos cur = goal;
    while (!(cur == start)) {
        path.push_back(cur);
        cur = parent[cur.r][cur.c];
    }
    reverse(path.begin(), path.end());
    return path;
}

bool can_reach_tail(const State& st) {
    if (st.snake.empty()) return false;
    Pos head = st.snake.front();
    Pos tail = st.snake.back();
    if (head == tail) return true;
    return !shortest_path(st, head, tail, true).empty();
}

int reachable_area(const State& st) {
    vector<vector<bool>> blocked = build_blocked(st, true);
    Pos head = st.snake.front();
    blocked[head.r][head.c] = false;

    queue<Pos> q;
    vector<vector<bool>> vis(BOARD_SIZE, vector<bool>(BOARD_SIZE, false));
    q.push(head);
    vis[head.r][head.c] = true;
    int count = 0;

    while (!q.empty()) {
        Pos cur = q.front();
        q.pop();
        ++count;
        for (const Pos& nxt : neighbors4(cur)) {
            if (!in_board(nxt) || blocked[nxt.r][nxt.c] || vis[nxt.r][nxt.c]) continue;
            vis[nxt.r][nxt.c] = true;
            q.push(nxt);
        }
    }
    return count;
}

bool advance_state(State& st, char cmd) {
    if (st.snake.size() > 1 && cmd == opposite_dir(st.dir)) {
        return false;
    }

    Pos next_head = step_to(st.snake.front(), cmd);
    if (!in_board(next_head)) return false;
    if (terrain[next_head.r][next_head.c] == '#' || terrain[next_head.r][next_head.c] == 'O') {
        return false;
    }

    bool eat = st.food.has_value() && next_head == *st.food;
    bool periodic_growth = ((st.moves + 1) % grow_every == 0);
    bool grow = eat || periodic_growth;

    for (size_t i = 0; i < st.snake.size(); ++i) {
        if (!(st.snake[i] == next_head)) continue;
        bool moving_into_tail = (i + 1 == st.snake.size());
        if (!(moving_into_tail && !grow)) {
            return false;
        }
    }

    st.snake.push_front(next_head);
    if (eat) {
        st.food.reset();
        st.score += 10;
    }
    if (!grow) {
        st.snake.pop_back();
    }

    st.dir = cmd;
    ++st.moves;
    return true;
}

int safe_food_distance(const State& st) {
    if (!st.food.has_value()) return INF;
    vector<Pos> path = shortest_path(st, st.snake.front(), *st.food, true);
    if (path.empty()) return INF;

    State sim = st;
    Pos cur = sim.snake.front();
    for (const Pos& nxt : path) {
        char cmd = dir_from_to(cur, nxt);
        if (!advance_state(sim, cmd)) return INF;
        cur = nxt;
    }

    return can_reach_tail(sim) ? static_cast<int>(path.size()) : INF;
}

int food_distance(const State& st) {
    if (!st.food.has_value()) return INF;
    vector<Pos> path = shortest_path(st, st.snake.front(), *st.food, true);
    if (path.empty()) return INF;
    return static_cast<int>(path.size());
}

vector<char> candidate_dirs(char current_dir) {
    if (current_dir == 'W') return {'W', 'A', 'D', 'S'};
    if (current_dir == 'S') return {'S', 'D', 'A', 'W'};
    if (current_dir == 'A') return {'A', 'S', 'W', 'D'};
    return {'D', 'W', 'S', 'A'};
}

char choose_move(const State& st) {
    struct Candidate {
        char cmd = 'W';
        State next;
        int tier = -1;
        int safe_food_dist = INF;
        int tail_dist = INF;
        int plain_food_dist = INF;
        int area = -1;
        bool prefer_current = false;
    };

    auto better = [](const Candidate& a, const Candidate& b) {
        if (a.tier != b.tier) return a.tier > b.tier;
        if (a.tier == 3 && a.safe_food_dist != b.safe_food_dist) return a.safe_food_dist < b.safe_food_dist;
        if (a.area != b.area) return a.area > b.area;
        if (a.plain_food_dist != b.plain_food_dist) return a.plain_food_dist < b.plain_food_dist;
        if (a.tail_dist != b.tail_dist) return a.tail_dist < b.tail_dist;
        if (a.prefer_current != b.prefer_current) return a.prefer_current;
        return a.cmd < b.cmd;
    };

    bool found = false;
    Candidate best;

    for (char cmd : candidate_dirs(st.dir)) {
        State nxt = st;
        if (!advance_state(nxt, cmd)) continue;

        Candidate cand;
        cand.cmd = cmd;
        cand.next = nxt;
        cand.prefer_current = (cmd == st.dir);
        cand.area = reachable_area(nxt);
        cand.plain_food_dist = food_distance(nxt);
        cand.tail_dist = static_cast<int>(shortest_path(nxt, nxt.snake.front(), nxt.snake.back(), true).size());

        cand.safe_food_dist = safe_food_distance(nxt);
        if (cand.safe_food_dist != INF) {
            cand.tier = 3;
        } else if (can_reach_tail(nxt)) {
            cand.tier = 2;
        } else {
            cand.tier = 1;
        }

        if (!found || better(cand, best)) {
            best = cand;
            found = true;
        }
    }

    if (found) return best.cmd;

    for (char cmd : {'W', 'A', 'S', 'D'}) {
        if (st.snake.size() > 1 && cmd == opposite_dir(st.dir)) continue;
        return cmd;
    }
    return 'W';
}

deque<Pos> build_snake_from_map(const vector<string>& raw_map) {
    Pos head{-1, -1};
    set<pair<int, int>> body;

    for (int r = 0; r < BOARD_SIZE; ++r) {
        for (int c = 0; c < BOARD_SIZE; ++c) {
            if (raw_map[r][c] == 'H') {
                head = {r, c};
            } else if (raw_map[r][c] == 'B') {
                body.insert({r, c});
            }
        }
    }

    deque<Pos> snake;
    snake.push_back(head);
    Pos prev = head;
    Pos cur{-1, -1};

    for (const Pos& nxt : neighbors4(head)) {
        if (body.count({nxt.r, nxt.c})) {
            cur = nxt;
            break;
        }
    }

    while (cur.r != -1) {
        snake.push_back(cur);
        body.erase({cur.r, cur.c});

        Pos next_seg{-1, -1};
        for (const Pos& nxt : neighbors4(cur)) {
            if (nxt == prev) continue;
            if (body.count({nxt.r, nxt.c})) {
                next_seg = nxt;
                break;
            }
        }
        prev = cur;
        cur = next_seg;
    }

    return snake;
}

array<string, BOARD_SIZE> render_map(const State& st) {
    array<string, BOARD_SIZE> out = terrain;
    if (st.food.has_value()) {
        out[st.food->r][st.food->c] = 'F';
    }
    for (size_t i = 0; i < st.snake.size(); ++i) {
        out[st.snake[i].r][st.snake[i].c] = (i == 0 ? 'H' : 'B');
    }
    return out;
}

}  // namespace

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    vector<string> raw_map(BOARD_SIZE);
    for (int i = 0; i < BOARD_SIZE; ++i) {
        if (!(cin >> raw_map[i])) return 0;
    }
    if (!(cin >> grow_every)) return 0;

    State state;
    state.snake = build_snake_from_map(raw_map);
    state.dir = 'W';
    state.score = 0;
    state.moves = 0;

    for (int r = 0; r < BOARD_SIZE; ++r) {
        terrain[r] = raw_map[r];
        for (int c = 0; c < BOARD_SIZE; ++c) {
            if (raw_map[r][c] == 'F') {
                state.food = Pos{r, c};
                terrain[r][c] = '.';
            } else if (raw_map[r][c] == 'H' || raw_map[r][c] == 'B') {
                terrain[r][c] = '.';
            }
        }
    }

    while (true) {
        char cmd = choose_move(state);
        cout << cmd << '\n' << state.score << '\n';
        cout.flush();

        int x = 0, y = 0;
        if (!(cin >> x >> y)) return 0;

        if (x == 100 && y == 100) {
            array<string, BOARD_SIZE> final_map = render_map(state);
            for (const string& row : final_map) {
                cout << row << '\n';
            }
            cout << state.score << '\n';
            cout.flush();
            return 0;
        }

        if (!advance_state(state, cmd)) {
            array<string, BOARD_SIZE> final_map = render_map(state);
            for (const string& row : final_map) {
                cout << row << '\n';
            }
            cout << state.score << '\n';
            cout.flush();
            return 0;
        }

        if (x > 0 && x < 19 && y > 0 && y < 19) {
            state.food = Pos{x, y};
        }
    }
}
