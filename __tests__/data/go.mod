module example.com/mymodule

go 1.14

require (
	example.com/othermodule v1.2.3
	example.com/thismodule v1.2.3
	example.com/thatmodule v1.2.3
)

replace example.com/thatmodule => ../thatmodule
exclude example.com/thismodule v1.3.0
