module cairn

go 1.25

require github.com/spf13/cobra v1.10.1
require github.com/pelletier/go-toml/v2 v2.2.3

replace github.com/spf13/cobra => ./third_party/cobra
replace github.com/pelletier/go-toml/v2 => ./third_party/go-toml
