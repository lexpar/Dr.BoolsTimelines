from .actor import Actor
from .cell import Cell, WorldInhabitant
from .globals import VARIABLES

import random
import uuid


class GameInstance:
    """Container for world and actors in world.

    GameInstance is responsible for tracking the world and the actors
    within it. It has functions to simplify interacting with the world
    and actors in it. It also provides functions that actors can call
    for information about the world, in order to aid in their decision
    making.

    Most functions that have a signature of the form fn(x,y) can
    accept a number of different arguments. The goal is to have as open
    an api as possible, given
    """
    def __init__(self, model=None):
        if not model:
            # For testing.
            self.actors = {}
            self.world = []
            self.world_size = 250
        else:
            self.uuid = str(model.uuid)
            self.current_turn = model.current_turn_number
            self.actors = {}
            self.world = []
            self.world_size = 250

            self.init_empty_world()
            for a in model.actors.all():
                self.add_actor(Actor(a))

    def __getitem__(self, item):
        x = self.world[item]
        return x

    def init_empty_world(self):
        """Create an empty 50x50 cell grid for testing."""
        for i in range(self.world_size):
            row = [[Cell(i, j, 1, 0)] for j in range(self.world_size)]
            self.world.append(row)

    def coord_parse(self, x, y=None):
        """Handle coord parsing for ints and WorldInhabitants.

        If x is a WorldInhabitant, return it's coords. Otherwise,
        ensure x, y is a legal coord before returning.

        :param x: Integer or WorldInhabitant with coords
        :param y: Integer or None
        :return: x,y integer tuple of coord
        """
        if isinstance(x, WorldInhabitant):
            x, y = self.coord_parse(*x._coords)
            return x, y
        elif isinstance(x, int) and isinstance(y, int):
            if x < 0 or y < 0:
                tmp = "Coord does not exist ({}, {})."
                raise ValueError(tmp.format(x, y))
            return x % self.world_size, y % self.world_size
        else:
            tmp = "Can't parse coords from ({}, {})."
            raise ValueError(tmp.format(x, y))

    def add_actor(self, a, x=0, y=0):
        """Add an Actor to the GameInstance.

        :param a: Actor object to be added.
        :param x: x coord OR a WorldInhabitant (such as a Cell)
        :param y: y coord
        """
        atest = self.actors.get(a.uuid)
        x, y = self.coord_parse(x, y)
        if atest:
            tmp = "{} already in GameInstance."
            raise ValueError(tmp.format(atest))

        if x==0 and y==0:
            for x, y in zip(range(10), range(10)):
                atest = self.get_actor(x, y)
                if not atest:
                    self.actors[a.uuid] = a
                    a._coords = (x, y)
                    a.gameInstance = self
                    self.world[x][y].append(a)
                    break

        else:
            atest = self.get_actor(x, y)
            if atest:
                tmp = "{0} already at coord. Only 1 Actor on a cell at a time."
                raise ValueError(tmp.format(atest))

            self.actors[a.uuid] = a
            a._coords = (x, y)
            a.gameInstance = self
            self.world[x][y].append(a)

    def remove_actor(self, x, y=None):
        """Remove an actor from the GameInstance. Fail silently.

        :param x: x coord OR a WorldInhabitant object.
        :param y: y coord
        """
        x, y = self.coord_parse(x, y)
        actr = self.get_actor(x, y)
        if not actr:
            return

        del self.actors[actr.uuid]
        self.world[x][y].remove(actr)
        actr._coords = (-1, -1)
        return

    def get_actor(self, x, y=None):
        """Get actor by _coords, UUID, or WorldInhabitant.

        :param x: x coord OR UUID of actor
        :param y: y coord
        :return: Actor that fits description, or None
        """
        if isinstance(x, uuid.UUID):
            return self.actors.get(x)
        if isinstance(x, WorldInhabitant):
            x, y = self.coord_parse(x, y)

        content = self[x][y]
        if len(content) > 1:
            for z in content:
                if isinstance(z, Actor):
                    return z
        return None

    def look_around(self, x, y=None, size=3):
        """Find and return nearest cells.

        :param x: x coord OR a WorldInhabitant
        :param y: y coord
        :param size: int of size to return.
        :return: size*size grid centered at x, y
        """
        x, y = self.coord_parse(x, y)

    def do_turn(self, up_to=0):
        all_turns = []
        import pdb
        pdb.set_trace()
        while self.current_turn <= up_to:
            self.current_turn += 1
            this_turn = {'number': self.current_turn, 'deltas': []}
            for uuid, actor in self.actors.items():
                this_turn['deltas'].append(actor.do_turn())

            all_turns.append(this_turn)

        return all_turns
